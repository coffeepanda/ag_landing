"""Export the Singing Glass "Up close" bundle from a saved final_scale result.

Reads only NumPy/JSON payloads (``<result>/data/<dataset>/arrays.npz``); no engine,
no solving. Writes public/demos/glass/closeup.json with, for each of the 12 glasses:

- the 10 solved modes: damped frequency, decay rate, release amplitude/phase,
  circumferential order n and the mode's coefficients on the cos/sin(n theta) basis
  rows (mass-normalised eigenvector entries);
- the simulated mallet contact, resampled over its first 60 us: contact force,
  mallet position, overlap and all 10 modal coordinates;
- mode-family energies after release, strike/readout angles.

The page rebuilds the displacement field from the model's own prescribed basis,
    u(theta, z) = (z/H)^2 * [r(theta) e_r + t(theta) e_theta],
    r = cos(n theta) | sin(n theta),  t = -sin(n theta)/n | cos(n theta)/n,
so the exporter first checks that this analytic basis reproduces the saved one.

It also writes, per glass, public/demos/glass/air/NN.bin: the radiated pressure of each
mode on a horizontal slice through the bowl, from the case's own surface-source
surrogate (simulation._pressure): p = -rho w^2/(4 pi) sum_i A_i v_i exp(ikR)/R over the
saved wall patches. With ag-physics on PYTHONPATH it cross-checks against that function.

Usage:
    python -I tools/export_glass_closeup.py <result-dir>
"""

import argparse
import json
from pathlib import Path

import numpy as np

NOTES = ('A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5')
WINDOW = 60e-6   # s of contact history kept for the replay (contact lasts ~40-45 us)
SAMPLES = 96


def arrays(root, name):
    with np.load(root / 'data' / name / 'arrays.npz', allow_pickle=False) as z:
        return {k: z[k] for k in z.files}


def meta(root, name):
    return json.loads((root / 'data' / name / 'description.json').read_text()).get('metadata', {})


def analytic_basis(points, orders, height):
    theta = np.arctan2(points[:, 1], points[:, 0])
    shape = (points[:, 2] / height) ** 2
    out = np.zeros((len(orders), len(points), 3))
    for j, n in enumerate(orders):
        r = np.cos(n * theta) if j % 2 == 0 else np.sin(n * theta)
        t = -np.sin(n * theta) / n if j % 2 == 0 else np.cos(n * theta) / n
        out[j, :, 0] = shape * (r * np.cos(theta) - t * np.sin(theta))
        out[j, :, 1] = shape * (r * np.sin(theta) + t * np.cos(theta))
    return out


def r(a, d):
    return np.round(np.asarray(a, float), d).ravel().tolist()


AIR_DENSITY, SOUND_SPEED = 1.2, 343.0   # the case model's air (model.py)
AIR_N, AIR_HALF = 72, 0.22              # slice grid: 72 x 72 over +-22 cm


def pressure_per_mode(geo, eig, omega, targets):
    """The case's surface-source pressure (simulation._pressure) for one mode, per unit
    modal coordinate: p = -rho w^2/(4 pi) sum_i A_i (radial_basis_i . eig) e^{ikR}/R."""
    strength = geo['source_areas'] * (geo['source_radial_basis'] @ eig)
    R = np.linalg.norm(targets[:, None, :] - geo['source_centres'][None], axis=2)
    return -AIR_DENSITY * omega ** 2 / (4 * np.pi) * ((np.exp(1j * omega / SOUND_SPEED * R) / R) @ strength)


def check_against_case(root, geo_name, geo, eig, omega, targets):
    """Compare with the case's own _pressure when ag-physics is importable."""
    try:
        from examples._shared import load_result
        from singing_glass import model, simulation
    except ImportError:
        return None
    ds = load_result(root).datasets()[geo_name]
    ref = simulation._pressure(model.default_config(profile='reference'), omega, ds, targets, eig.astype(complex))
    ours = pressure_per_mode(geo, eig, omega, targets)
    return float(np.abs(ref - ours).max() / np.abs(ref).max())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('result', type=Path)
    ap.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[1] / 'public/demos/glass/closeup.json')
    root = ap.parse_args().result
    out = ap.parse_args().out

    table = arrays(root, 'note_table')
    worst = 0.0
    for s in np.unique(table['shape']):
        g = arrays(root, f'shape_{int(s):02d}.mechanics_geometry')
        H = g['points'][:, 2].max()
        worst = max(worst, float(np.abs(analytic_basis(g['points'], g['order'], H) - g['basis']).max()))
    if worst > 1e-12:
        raise SystemExit(f'analytic basis differs from saved basis by {worst:.2e}')

    glasses = []
    air_dir = out.parent / 'air'
    air_dir.mkdir(parents=True, exist_ok=True)
    air_check = None
    for i, note in enumerate(NOTES):
        rel = arrays(root, f'note_{i:02d}.release_modes')
        rmeta = meta(root, f'note_{i:02d}.release_modes')
        orders = arrays(root, f'shape_{int(table["shape"][i]):02d}.mechanics_geometry')['order']
        cos_rows = np.arange(len(orders)) % 2 == 0
        modes = []
        for j in range(len(rel['damped_frequency'])):
            n = int(rel['mode_order'][j])
            v = rel['eigenvectors'][:, j]
            modes.append(dict(
                f=float(rel['damped_frequency'][j]), gamma=float(rel['gamma'][j]),
                amp=float(rel['amplitude'][j]), phase=float(rel['phase'][j]), n=n,
                c=float(v[(orders == n) & cos_rows].sum()), s=float(v[(orders == n) & ~cos_rows].sum()),
            ))
        # ---- radiated pressure on a horizontal slice at 85% of the bowl height (model frame:
        # z up along the glass axis, z = 0 at the bowl foot), one complex field per mode.
        geo_name = f'shape_{int(table["shape"][i]):02d}.mechanics_geometry'
        geo = arrays(root, geo_name)
        H = float(table['height'][i])
        ax = (np.arange(AIR_N) + 0.5) / AIR_N * 2 * AIR_HALF - AIR_HALF
        X, Y = np.meshgrid(ax, ax, indexing='xy')                   # row = y, column = x
        targets = np.column_stack((X.ravel(), Y.ravel(), np.full(X.size, 0.85 * H)))
        fields = []
        for j in range(len(rel['damped_frequency'])):
            omega = 2 * np.pi * float(rel['frequency'][j])
            fields.append(pressure_per_mode(geo, rel['eigenvectors'][:, j], omega, targets))
            if air_check is None:
                air_check = check_against_case(root, geo_name, geo, rel['eigenvectors'][:, j], omega, targets[:256])
        P = np.stack(fields)                                         # (mode, point) Pa per unit q
        # Pressure scale for display: the released modal amplitudes times these fields.
        typical = np.abs((P * rel['amplitude'][:, None])).sum(0).max()
        pscale = np.abs(P).max() / 32767
        blob = np.stack((P.real, P.imag), -1)                        # (mode, point, 2)
        (air_dir / f'{i:02d}.bin').write_bytes(np.round(blob / pscale).astype('<i2').tobytes())

        con = arrays(root, f'note_{i:02d}.contact')
        t = con['time']
        grid = np.linspace(0, WINDOW, SAMPLES)
        lerp = lambda y: np.interp(grid, t, y)  # noqa: E731
        q = np.stack([lerp(con['modal_position'][:, j]) for j in range(con['modal_position'].shape[1])], 1)
        contact_end = float(t[np.flatnonzero(con['force'] > 0)[-1]])
        glasses.append(dict(
            note=note, radius=float(table['radius'][i]), height=float(table['height'][i]),
            thickness=float(table['thickness'][i]), depth=float(table['water_depth'][i]),
            modes=modes,
            family=dict(order=rel['family_order'].tolist(), energy=r(rel['family_energy'], 15),
                        frequency=r(rel['family_frequency'], 3)),
            contact=dict(t_us=r(grid * 1e6, 3), force=r(lerp(con['force']), 6), mallet=r(lerp(con['mallet_position']), 12),
                         overlap=r(lerp(con['overlap']), 12), q=r(q, 13), end_us=contact_end * 1e6,
                         peak_force=float(con['force'].max())),
            strike_angle=float(rmeta['actual_angles_rad'][0]), readout_angle=float(rmeta['actual_angles_rad'][1]),
            air=dict(file=f'air/{i:02d}.bin', n=AIR_N, half=AIR_HALF, z=0.85 * H, scale=pscale, peak_pa=float(typical),
                     layout='mode-major, rows = model y, columns = model x, (re, im) int16; Pa per unit modal coordinate'),
        ))

    bundle = dict(version=1, glasses=glasses,
                  mallet=dict(mass_kg=0.0005, speed_m_s=0.04, stiffness_N_m=2e6),
                  basis='u = (z/H)^2 [r e_r + t e_theta]; r = c cos(n th) + s sin(n th); t = (-c sin(n th) + s cos(n th))/n',
                  units=dict(q='m kg^0.5 (mass-normalised)', c_s='kg^-0.5', amp='m kg^0.5'))
    out.write_text(json.dumps(bundle, separators=(',', ':')))
    g0 = glasses[0]
    rim = sum(m['amp'] * np.hypot(m['c'], m['s']) for m in g0['modes'])
    print(f'wrote {out} ({out.stat().st_size} B); basis check {worst:.1e}; '
          f'pressure vs case _pressure: {"n/a (ag-physics not on path)" if air_check is None else f"{air_check:.1e}"}')
    print(f"A4 pressure bound on slice: {glasses[0]['air']['peak_pa'] * 1e3:.3f} mPa")
    print(f"A4: contact {g0['contact']['end_us']:.1f} us, peak {g0['contact']['peak_force']:.3f} N, rim amplitude bound {rim*1e9:.2f} nm")


if __name__ == '__main__':
    main()
