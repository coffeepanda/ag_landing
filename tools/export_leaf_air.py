"""Export the "In the air" close-up bundle from a saved leaf shell/air FSI result.

Reads only NumPy/JSON payloads from a completed ``leaf_fall.fsi_snapshot`` result
(``<result>/data/<dataset>/arrays.npz``); no engine import, no solve, no mesher.
Writes the display bundle used by the landing page:

    public/demos/leaf/air.json   metadata, leaf shell per accepted step, summaries
    public/demos/leaf/air.bin    int16 grids: 3D air velocity, slice speed/pressure

Air values are evaluated from the saved native fields with the same affine-tetra
P2 (velocity) / P1 (pressure) shape functions the replay renderer uses, at the
centres of a regular display grid. Grid points that fall outside the air (inside
the leaf's thin excluded volume) are marked and left at zero. The field is the
last accepted state (6 ms); the leaf shell is exported for every accepted state.

Usage:
    python -I tools/export_leaf_air.py <result-dir> [--grid 40 40 24] [--slice 192 120]
"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

EDGES = ((0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3))


def arrays(root: Path, name: str):
    with np.load(root / 'data' / name / 'arrays.npz', allow_pickle=False) as z:
        return {k: z[k] for k in z.files}


class AirField:
    """P2 velocity / P1 pressure on the saved affine tetrahedra."""

    def __init__(self, native):
        p = native['mesh_points']
        self.cells = native['cells']
        self.tet = p[self.cells]                                         # (C,4,3)
        nodes = np.concatenate((self.tet, np.stack([(self.tet[:, i] + self.tet[:, j]) / 2 for i, j in EDGES], 1)), 1)
        d, ids = cKDTree(native['velocity_points']).query(nodes.reshape(-1, 3))
        pd, pids = cKDTree(native['pressure_points']).query(p)
        if max(d.max(), pd.max()) > 1e-10:
            raise SystemExit('expected affine tetra P2 vertex/edge velocity nodes and P1 vertex pressure')
        self.uv = native['velocity_vectors'][ids].reshape(-1, 10, 3)
        self.pv = native['pressure'][pids][self.cells]
        # Inverse affine maps for barycentric coordinates.
        T = np.transpose(self.tet[:, 1:] - self.tet[:, :1], (0, 2, 1))  # (C,3,3)
        self.inv = np.linalg.inv(T)
        self.tree = cKDTree(self.tet.mean(1))

    def locate(self, x, k=32):
        """Containing cell and barycentric coordinates for points x (N,3); cell=-1 if none."""
        _, cand = self.tree.query(x, k=k)
        cell = np.full(len(x), -1)
        bary = np.zeros((len(x), 4))
        for j in range(k):
            c = cand[:, j]
            todo = cell < 0
            if not todo.any():
                break
            r = np.einsum('nij,nj->ni', self.inv[c[todo]], x[todo] - self.tet[c[todo], 0])
            b = np.column_stack((1 - r.sum(1), r))
            ok = b.min(1) >= -1e-9
            idx = np.flatnonzero(todo)[ok]
            cell[idx] = c[todo][ok]
            bary[idx] = b[ok]
        return cell, bary

    def velocity(self, cell, b):
        shape = np.column_stack([b * (2 * b - 1)] + [4 * b[:, i] * b[:, j] for i, j in EDGES])  # (N,10)
        return np.einsum('nk,nkd->nd', shape, self.uv[cell])

    def pressure(self, cell, b):
        return np.einsum('nk,nk->n', b, self.pv[cell])


def q16(a, scale):
    """Quantize to int16 with a declared scale (value = int * scale)."""
    return np.clip(np.round(np.asarray(a) / scale), -32767, 32767).astype('<i2')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('result', type=Path)
    ap.add_argument('--grid', type=int, nargs=3, default=[40, 40, 24])
    ap.add_argument('--slice', type=int, nargs=2, default=[192, 120])
    ap.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[1] / 'public/demos/leaf')
    args = ap.parse_args()
    root = args.result

    diag = json.loads((root / 'diagnostics.json').read_text())
    steps = int(diag['accepted_steps'])
    native = arrays(root, 'native')
    air = AirField(native)
    lo, hi = native['mesh_points'].min(0), native['mesh_points'].max(0)

    # ---- 3D velocity on cell-centred grid points
    nx, ny, nz = args.grid
    axes = [lo[i] + (np.arange(n) + 0.5) * (hi[i] - lo[i]) / n for i, n in enumerate((nx, ny, nz))]
    X, Y, Z = np.meshgrid(*axes, indexing='ij')
    pts = np.column_stack((X.ravel(), Y.ravel(), Z.ravel()))
    cell, b = air.locate(pts)
    inside = cell >= 0
    vel = np.zeros((len(pts), 3))
    vel[inside] = air.velocity(cell[inside], b[inside])

    # ---- shell states (structure observations): reference + every accepted step
    first = arrays(root, 'initial_structure')
    quads = first['cells']
    states = [first['points']] + [arrays(root, f'accepted_{i:04d}_structure')['points'] for i in range(steps)]
    times = [0.0] + [float(r['time']) for r in diag['records']]
    leaf_now = states[-1]

    # ---- vertical slice through the leaf (x-z plane at the leaf's mean y)
    sx, sz = args.slice
    plane_y = float(leaf_now[:, 1].mean())
    xs = lo[0] + (np.arange(sx) + 0.5) * (hi[0] - lo[0]) / sx
    zs = lo[2] + (np.arange(sz) + 0.5) * (hi[2] - lo[2]) / sz
    SX, SZ = np.meshgrid(xs, zs, indexing='xy')                         # row = z
    sp = np.column_stack((SX.ravel(), np.full(SX.size, plane_y), SZ.ravel()))
    scell, sb = air.locate(sp)
    sin = scell >= 0
    s_speed = np.zeros(len(sp))
    s_press = np.zeros(len(sp))
    s_speed[sin] = np.linalg.norm(air.velocity(scell[sin], sb[sin]), axis=1)
    s_press[sin] = air.pressure(scell[sin], sb[sin])

    # ---- displacement history (true scale and elastic part after a rigid fit)
    ref = states[0]

    def elastic(cur):
        a = ref - ref.mean(0)
        c = cur - cur.mean(0)
        U, _, V = np.linalg.svd(a.T @ c)
        D = np.eye(3)
        D[2, 2] = np.linalg.det(U @ V)
        R = U @ D @ V
        return cur - (a @ R + cur.mean(0))

    residuals = [elastic(s) for s in states]
    total = [float(np.linalg.norm(s - ref, axis=1).max()) for s in states]
    warp = [float(np.linalg.norm(e, axis=1).max()) for e in residuals]

    # Texture coordinates in the leaf's own plane (reference shell, pitch removed by PCA).
    c0 = ref - ref.mean(0)
    _, _, Vt = np.linalg.svd(c0, full_matrices=False)
    span_axis, chord_axis = Vt[0], Vt[1]
    if span_axis[1] < 0:
        span_axis = -span_axis
    sv, cv = c0 @ span_axis, c0 @ chord_axis
    uv = np.column_stack(((cv - cv.min()) / np.ptp(cv), (sv - sv.min()) / np.ptp(sv)))
    # Leaf frame at the last state, so display particles that meet the (zero-thickness)
    # shell are retired instead of interpolating through it.
    cur = leaf_now - leaf_now.mean(0)
    _, _, Vn = np.linalg.svd(cur, full_matrices=False)
    rl = lambda a, d: np.round(np.asarray(a, float), d).tolist()  # noqa: E731
    frame = dict(center=rl(leaf_now.mean(0), 7), span=rl(Vn[0], 6), chord=rl(Vn[1], 6), normal=rl(Vn[2], 6),
                 half_span=float(np.abs(cur @ Vn[0]).max()), half_chord=float(np.abs(cur @ Vn[1]).max()))

    # Leaf cross-section on the slice plane (segments x0,z0,x1,z1) at the last state.
    tri_idx = np.concatenate((quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]))
    cut = []
    for t3 in leaf_now[tri_idx]:
        d = t3[:, 1] - plane_y
        hits = []
        for i, j in ((0, 1), (1, 2), (2, 0)):
            if d[i] * d[j] < 0:
                f = d[i] / (d[i] - d[j])
                hits.append(t3[i] + f * (t3[j] - t3[i]))
        if len(hits) == 2:
            cut += [hits[0][0], hits[0][2], hits[1][0], hits[1][2]]

    # Forces on the leaf from the interface traction, per accepted step (N).
    forces = []
    for i in range(steps):
        nat = arrays(root, f'accepted_{i:04d}_native')
        forces.append(np.asarray(nat['force'], float).ravel()[:3].tolist())

    # ---- binary: velocity grid (xyz interleaved), slice speed, slice pressure
    vscale = 2e-5   # m/s per unit (range +-0.65 m/s)
    pscale = 1e-5   # Pa per unit
    blob = [q16(vel, vscale).ravel(), q16(s_speed, vscale), q16(s_press, pscale)]
    args.out.mkdir(parents=True, exist_ok=True)
    offsets, pos = [], 0
    with open(args.out / 'air.bin', 'wb') as f:
        for a in blob:
            offsets.append(pos)
            f.write(a.tobytes())
            pos += a.size
    mask_bits = np.packbits(inside.astype(np.uint8)).tobytes()

    def r(a, d):
        return np.round(np.asarray(a, float), d).ravel().tolist()

    tri = tri_idx
    meta = dict(
        version=1,
        time=times,                                   # s, accepted states (0 = rest)
        box=dict(lo=r(lo, 6), hi=r(hi, 6)),           # m, z up
        wind=0.3,
        pitch_deg=20.0,
        grid=dict(n=[nx, ny, nz], scale=vscale, offset=offsets[0], inside=list(mask_bits)),
        slice=dict(n=[sx, sz], y=plane_y, speed_offset=offsets[1], pressure_offset=offsets[2],
                   speed_scale=vscale, pressure_scale=pscale,
                   speed_max=float(s_speed.max()), pressure_range=[float(s_press.min()), float(s_press.max())]),
        leaf=dict(points=[r(s, 7) for s in states], elastic=[r(e, 9) for e in residuals],
                  uv=r(uv, 4), triangles=tri.ravel().tolist(), quads=len(quads), cut=r(cut, 6), frame=frame),
        history=dict(total=total, elastic=warp, force=forces),
        field=dict(time=times[-1], speed_max=float(np.linalg.norm(native['velocity_vectors'], axis=1).max()),
                   pressure_range=[float(native['pressure'].min()), float(native['pressure'].max())],
                   tetrahedra=int(len(air.cells))),
    )
    (args.out / 'air.json').write_text(json.dumps(meta, separators=(',', ':')))

    print(f'grid {nx}x{ny}x{nz}: {inside.mean() * 100:.1f}% in air; max |u| {np.linalg.norm(vel, axis=1).max():.3f} m/s')
    print(f'slice {sx}x{sz} at y={plane_y:.4f} m: speed max {s_speed.max():.3f} m/s, pressure {s_press.min():.4f}..{s_press.max():.4f} Pa')
    print(f'native: speed max {meta["field"]["speed_max"]:.4f} m/s, pressure {meta["field"]["pressure_range"]}, {len(air.cells)} tets')
    print(f'leaf: {len(states)} states; total disp max {max(total) * 1e3:.4f} mm, elastic max {max(warp) * 1e6:.2f} um')
    print(f'force N per step: {np.round(forces, 6).tolist()}')
    print(f'wrote air.json ({(args.out / "air.json").stat().st_size} B), air.bin ({(args.out / "air.bin").stat().st_size} B)')


if __name__ == '__main__':
    main()
