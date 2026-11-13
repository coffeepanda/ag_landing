"""Export the Singing Glass web bundle from a saved ag-physics result.

Reads only NumPy/JSON payloads from a completed ``singing_glass.final_scale``
result (``<result>/data/<dataset>/arrays.npz``); no engine import, no solving.
Writes the small display bundle used by the landing page:

    public/demos/glass/glass.json

Only what the page draws and plays is exported: per-glass dimensions and water
depth, and per-mode frequency, decay, phase, circumferential order, rim shape
coefficients and the rim-readout sound weight. Nothing else leaves the result.

Usage:
    python tools/export_glass.py <result-dir> [--out public/demos/glass/glass.json]
"""

import argparse
import json
from pathlib import Path

import numpy as np

NOTE_NAMES = ('A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5')


def arrays(root: Path, name: str):
    with np.load(root / 'data' / name / 'arrays.npz', allow_pickle=False) as z:
        return {k: z[k] for k in z.files}


def synth(modes, t):
    """Rim readout signal: sum_j w_j exp(-gamma_j t) sin(wd_j t + phase_j)."""
    return sum(m['w'] * np.exp(-m['gamma'] * t) * np.sin(2 * np.pi * m['f'] * t + m['phase']) for m in modes)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('result', type=Path)
    p.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[1] / 'public/demos/glass/glass.json')
    args = p.parse_args()
    root = args.result

    table = arrays(root, 'note_table')
    geometry = {s: arrays(root, f'shape_{s:02d}.mechanics_geometry') for s in np.unique(table['shape'])}

    glasses, worst = [], 0.0
    for i, name in enumerate(NOTE_NAMES):
        rel = arrays(root, f'note_{i:02d}.release_modes')
        orders = geometry[int(table['shape'][i])]['order']   # basis -> circumferential order
        cos_rows = np.arange(len(orders)) % 2 == 0           # even basis: cos(n theta), odd: sin
        modes = []
        for j in range(len(rel['damped_frequency'])):
            n = int(rel['mode_order'][j])
            vec = rel['eigenvectors'][:, j]
            a = float(rel['amplitude'][j])
            modes.append(dict(
                f=float(rel['damped_frequency'][j]),
                gamma=float(rel['gamma'][j]),
                phase=float(rel['phase'][j]),
                n=n,
                # Rim radial displacement amplitude (m) of this mode: c cos(n th) + s sin(n th).
                c=a * float(vec[(orders == n) & cos_rows].sum()),
                s=a * float(vec[(orders == n) & ~cos_rows].sum()),
                # Sound weight (m): modal amplitude times the rim readout projection.
                w=a * float(rel['readout_projection'][j]),
            ))

        # Check against the saved sonification (ignoring its 2 ms / 100 ms playback fades).
        cmp_ = arrays(root, f'note_{i:02d}.comparison')
        t, saved = cmp_['time'], cmp_['contact']
        core = slice(int(0.01 * len(t)), int(0.9 * len(t)))
        err = np.max(abs(synth(modes, t[core]) - saved[core])) / np.max(abs(saved))
        worst = max(worst, float(err))

        glasses.append(dict(
            note=name,
            midi=int(table['midi'][i]),
            shape=int(table['shape'][i]),
            radius=float(table['radius'][i]),
            height=float(table['height'][i]),
            thickness=float(table['thickness'][i]),
            depth=float(table['water_depth'][i]),
            modes=sorted(modes, key=lambda m: m['f']),
        ))

    if worst > 1e-6:
        raise SystemExit(f'synthesis mismatch vs saved sonification: {worst:.3e}')

    def rounded(x):
        if isinstance(x, float):
            return float(f'{x:.7g}')
        if isinstance(x, list):
            return [rounded(v) for v in x]
        if isinstance(x, dict):
            return {k: rounded(v) for k, v in x.items()}
        return x

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(rounded(dict(version=1, glasses=glasses)), separators=(',', ':')))
    print(f'wrote {args.out} ({args.out.stat().st_size} bytes); max synth error {worst:.2e}')
    for g in glasses:
        m0 = g['modes'][0]
        print(f"{g['note']:>3}  f0={m0['f']:.2f} Hz  depth={g['depth']*1e3:.2f} mm  "
              f"modes n={[m['n'] for m in g['modes']]}")


if __name__ == '__main__':
    main()
