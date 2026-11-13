"""Export the Last Leaf web bundle from a saved ag-physics flexible-flight result.

Reads only NumPy/JSON payloads from a completed ``leaf_fall.flexible`` result
(``<result>/data/<dataset>/arrays.npz``); no engine import, no integration.
Writes the small display bundle used by the landing page:

    public/demos/leaf/leaf.json

Exported (display only): the leaf's reference outline mesh and its three
bending/twist shapes; the flight resampled at a uniform rate (position,
orientation, bending/twist coordinates); the prescribed breeze law; and the
breeze sampled along the flight. Nothing else leaves the result.

Resampling uses the saved velocities and rates (cubic Hermite) and spherical
interpolation of orientation, so the page can interpolate smoothly between
samples. It checks the resampled path against every saved sample.

Usage:
    python tools/export_leaf.py <result-dir> [--rate 120] [--out public/demos/leaf/leaf.json]
"""

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.interpolate import CubicHermiteSpline
from scipy.spatial.transform import Rotation, Slerp


def arrays(root: Path, name: str):
    with np.load(root / 'data' / name / 'arrays.npz', allow_pickle=False) as z:
        return {k: z[k] for k in z.files}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('result', type=Path)
    p.add_argument('--rate', type=float, default=120.0)
    p.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[1] / 'public/demos/leaf/leaf.json')
    args = p.parse_args()

    traj = arrays(args.result, 'trajectory')
    geo = arrays(args.result, 'geometry')
    loads = arrays(args.result, 'loads')
    wind = arrays(args.result, 'wind')

    t = traj['time']
    keep = np.r_[True, np.diff(t) > 0]   # drop duplicate end sample if present
    t = t[keep]
    clock = np.arange(0.0, t[-1], 1.0 / args.rate)
    clock = np.r_[clock, t[-1]] if clock[-1] < t[-1] - 1e-9 else clock

    pos = CubicHermiteSpline(t, traj['position'][keep], traj['velocity'][keep])(clock)
    eta = CubicHermiteSpline(t, traj['coordinates'][keep], traj['rates'][keep])(clock)
    quat_xyzw = traj['quaternion'][keep][:, [1, 2, 3, 0]]
    rot = Slerp(t, Rotation.from_quat(quat_xyzw))(clock)
    q = rot.as_quat()[:, [3, 0, 1, 2]]                       # back to wxyz
    for k in range(1, len(q)):                              # continuous hemisphere for browser slerp
        if np.dot(q[k], q[k - 1]) < 0:
            q[k] = -q[k]
    wind_samples = np.column_stack([np.interp(clock, t, loads['wind'][keep][:, j]) for j in range(3)])

    # Check: resampled path through the saved samples (position, mm).
    back = CubicHermiteSpline(t, traj['position'][keep], traj['velocity'][keep])(t)
    path_err = float(np.abs(back - traj['position'][keep]).max())
    if path_err > 1e-9:
        raise SystemExit(f'resampling does not reproduce saved positions: {path_err:.3e} m')

    vertices = geo['vertices']
    if np.abs(vertices[:, 2]).max() > 1e-12:
        raise SystemExit('expected flat reference vertices (z = 0)')

    def r(a, d):
        return np.round(np.asarray(a, float), d).ravel().tolist()

    bundle = dict(
        version=1,
        rate=args.rate,
        frames=len(clock),
        duration=float(clock[-1]),
        clearance=0.05,
        mesh=dict(
            xy=r(vertices[:, :2], 7),                 # m, body frame, centred on dry mass
            phi=r(geo['vertex_phi'], 6),              # vertex z = phi @ eta
            faces=np.asarray(geo['faces'], int).ravel().tolist(),
            boundary=np.asarray(geo['boundary'], int).ravel().tolist(),
        ),
        flight=dict(
            position=r(pos, 6),                       # m, z up
            quaternion=r(q, 6),                       # wxyz, body -> world
            eta=r(eta, 7),                            # m: span bend, chord bend, twist
            wind=r(wind_samples, 5),                  # m/s along the flight
        ),
        breeze=dict(                                  # U(t) = mean + sum A sin(w t + phase)
            mean=r(wind['mean'], 6),
            amplitude=r(wind['amplitude'], 6),
            frequency=r(wind['frequency'], 6),
            phase=r(wind['phase'], 6),
        ),
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(bundle, separators=(',', ':')))

    drop = pos[0, 2] - pos[-1, 2]
    drift = np.hypot(*(pos[-1, :2] - pos[0, :2]))
    print(f'wrote {args.out} ({args.out.stat().st_size} bytes)')
    print(f'{len(clock)} frames at {args.rate:g} Hz over {clock[-1]:.3f} s; drop {drop:.2f} m, drift {drift:.2f} m')
    print(f'max |eta| = {np.abs(eta).max() * 1e3:.2f} mm; mesh {len(vertices)} vertices / {len(geo["faces"])} faces')


if __name__ == '__main__':
    main()
