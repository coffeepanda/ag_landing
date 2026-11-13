"""Export the "A Room Made of Light" web bundle from saved ag-physics results.

Inputs (both from ``demos/03-room-of-light``):
  room    a completed direct-room result (``illuminate``), e.g. the wide-slit
          variant from the README stage recipe (aperture_width=0.6); it carries
          the grating stage's RCWA datasets and field payloads

Writes:
  public/demos/light/room.json    room faces, materials, band colours and per-band
                                  reflectances, RCWA order efficiencies (7 bands, TE/TM)
  public/demos/light/wave.json    grating relief and per-band grid metadata
  public/demos/light/wave.bin     int16 Re/Im of TE Ey over one period, 7 bands

The page traces the continuous-spectrum room light itself from these efficiencies
(see src/demos/light/rainbow.ts). The grating field is the exact time-harmonic
TE field: inside the ridged layer it is sampled from the saved RCWA
reconstruction payload; in the silica below and the air above it is the
Rayleigh sum of all saved complex order amplitudes. The exporter checks that
the two agree at both faces of the layer before writing.

Needs ag-physics on PYTHONPATH (for the saved-payload field sampler only).

Usage:
    python tools/export_light.py <room-result-dir>
"""

import argparse
import json
from pathlib import Path

import numpy as np

from ap.physics.optics.wave_optics.rcwa.reconstruction import sample_rcwa_fields
from examples._shared import load_result

OUT = Path(__file__).resolve().parents[1] / 'public/demos/light'


# ---------------------------------------------------------------- colour

def cie_xyz(lam_nm):
    """CIE 1931 2-degree colour matching functions, multi-lobe Gaussian fit (Wyman et al. 2013)."""
    l = np.asarray(lam_nm, float)

    def g(x, mu, s1, s2):
        s = np.where(x < mu, s1, s2)
        return np.exp(-0.5 * ((x - mu) / s) ** 2)
    x = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2)
    y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1)
    z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)
    return np.stack((x, y, z), -1)


XYZ2RGB = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])


def spectral_rgb(lam_nm):
    """Linear sRGB of a monochromatic line: desaturated toward white into gamut, brightest channel = 1."""
    rgb = XYZ2RGB @ cie_xyz(lam_nm)
    rgb = rgb - min(0.0, rgb.min())
    return rgb / rgb.max()


def reflect_rgb(lam_m, rho, source):
    """Linear sRGB of a surface reflectance under the saved source, white-balanced per channel."""
    xyz = cie_xyz(np.asarray(lam_m) * 1e9) * source[:, None]
    white = XYZ2RGB @ xyz.sum(0)
    rgb = XYZ2RGB @ (xyz * rho[:, None]).sum(0)
    return np.clip(rgb / white, 0, 1)


def arrays(root: Path, name: str):
    with np.load(root / 'data' / name / 'arrays.npz', allow_pickle=False) as z:
        return {k: z[k] for k in z.files}


def meta(root: Path, name: str):
    return json.loads((root / 'data' / name / 'description.json').read_text()).get('metadata', {})


def r(a, d):
    return np.round(np.asarray(a, float), d).ravel().tolist()


# ---------------------------------------------------------------- room

def export_room(root: Path, setup):
    m = setup['parameters']['model']
    geo = arrays(root, 'geometry')
    gm = meta(root, 'geometry')
    spec = arrays(root, 'spectrum')
    funcs = arrays(root, 'material_functions')
    fmeta = meta(root, 'material_functions')
    lam_nm = spec['wavelength'] * 1e9

    materials = {name: r(reflect_rgb(funcs['wavelength'], funcs['reflectance'][i], funcs['source_shape']), 4)
                 for i, name in enumerate(fmeta['materials'])}
    bands = [dict(nm=float(l), rgb=r(spectral_rgb(l), 4), weight=float(w)) for l, w in zip(lam_nm, spec['weight'])]

    faces = [dict(name=n, material=mat, origin=r(geo['origin'][i], 5), normal=r(geo['normal'][i], 5),
                  u=r(geo['u'][i], 5), v=r(geo['v'][i], 5), half=r(geo['half'][i], 5))
             for i, (n, mat) in enumerate(zip(gm['names'], gm['materials']))]

    # Efficiencies (finest Fourier level) for the plots.
    eff = []
    cut = max(setup['parameters']['numerics']['cutoffs'])
    for b in range(len(lam_nm)):
        row = []
        for pol in ('TE', 'TM'):
            a = arrays(root, f'rcwa_M{cut:02d}_b{b:02d}_{pol}')
            sel = np.abs(a['orders']) <= 2
            row.append(dict(orders=a['orders'][sel].tolist(), T=r(a['transmission'][sel], 5), R=r(a['reflection'][sel], 5)))
        eff.append(row)

    room = dict(
        version=1,
        size=m['room'], window=dict(y=m['window_y'], z=m['window_z'], width=m['aperture_width'], height=m['aperture_height']),
        period=m['period'], materials=materials, bands=bands, faces=faces,
        # Reflectance of each material at each band: lit colour = band colour * rho * E.
        band_reflectance={name: r(spec['reflectance'][i], 4) for i, name in enumerate(meta(root, 'spectrum')['materials'])},
        efficiency=eff,
    )
    (OUT / 'room.json').write_text(json.dumps(room, separators=(',', ':')))
    print(f'room.json {(OUT / "room.json").stat().st_size} B: {len(faces)} faces, {len(bands)} bands')
    return lam_nm, spec['silica_index']


# ---------------------------------------------------------------- grating field

def export_wave(root: Path, res, setup, lam_nm, n_silica, nx=72, nz=216, z0=-1.2e-6, z1=2.4e-6):
    m = setup['parameters']['model']
    P, d = m['period'], m['depth']
    ds = res.datasets()
    cut = max(setup['parameters']['numerics']['cutoffs'])
    x = (np.arange(nx) + 0.5) / nx * P - P / 2               # one period, ridge centred at x=0
    z = z0 + (np.arange(nz) + 0.5) / nz * (z1 - z0)
    fields, worst = [], 0.0
    for b in range(len(lam_nm)):
        pay = ds[f'field_payload_b{b:02d}_TE']
        rc = ds[f'rcwa_M{cut:02d}_b{b:02d}_TE'].arrays
        lam = pay.metadata['wavelength_m']
        k0 = 2 * np.pi / lam
        kx = np.asarray(pay.arrays['kx']).real
        ns = float(n_silica[b])
        kz_s = np.sqrt((ns ** 2 - kx ** 2).astype(complex))
        kz_a = np.sqrt((1 - kx ** 2).astype(complex))
        ph = np.exp(1j * k0 * np.outer(x, kx))                 # (nx, orders)
        E = np.zeros((nz, nx), complex)
        inc = rc['incident'][len(kx) // 2]
        for j, zz in enumerate(z):
            if zz < 0:      # silica: incident + reflected orders (evanescent decay away from z=0)
                E[j] = inc * np.exp(1j * k0 * ns * zz) + ph @ (rc['reflected'] * np.exp(-1j * k0 * kz_s * zz))
            elif zz > d:    # air: transmitted orders
                E[j] = ph @ (rc['transmitted'] * np.exp(1j * k0 * kz_a * (zz - d)))
        inside = (z >= 0) & (z <= d)
        zi = z[inside]
        X, Z = np.meshgrid(x, zi)
        pts = np.column_stack((X.ravel(), np.zeros(X.size), Z.ravel()))
        E[inside] = np.asarray(sample_rcwa_fields(pay, pts, layer=0).arrays['electric'])[:, 1].reshape(len(zi), nx)
        # Interface check: Rayleigh sums vs the saved interior field at both faces.
        for zz, outside in ((0.0, inc + ph @ rc['reflected']), (d, ph @ rc['transmitted'])):
            p2 = np.column_stack((x, np.zeros(nx), np.full(nx, zz)))
            interior = np.asarray(sample_rcwa_fields(pay, p2, layer=0).arrays['electric'])[:, 1]
            worst = max(worst, float(np.abs(interior - outside).max() / np.abs(interior).max()))
        fields.append(E)
    if worst > 1e-9:
        raise SystemExit(f'interface mismatch {worst:.2e}: amplitude convention changed?')
    amp = max(np.abs(E).max() for E in fields)
    scale = amp / 32767
    blob = np.concatenate([np.stack((E.real, E.imag), -1).ravel() for E in fields])
    (OUT / 'wave.bin').write_bytes(np.round(blob / scale).astype('<i2').tobytes())
    wave = dict(version=1, period=P, depth=d, fill=m['fill'], ridge_center=0.0, nx=nx, nz=nz, z=[z0, z1],
                bands=[dict(nm=float(l), n_silica=float(n)) for l, n in zip(lam_nm, n_silica)],
                scale=scale, layout='band-major, z rows (low z first), x columns, (re, im) int16',
                polarization='TE (E along the grooves)', time='exp(-i omega t)')
    (OUT / 'wave.json').write_text(json.dumps(wave, separators=(',', ':')))
    print(f'wave.bin {(OUT / "wave.bin").stat().st_size} B; max |Ey| {amp:.3f}; interface mismatch {worst:.1e}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('room', type=Path)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    root = args.room
    setup = json.loads((root / 'setup.json').read_text())
    res = load_result(root)
    lam_nm, n_silica = export_room(root, setup)
    export_wave(root, res, setup, lam_nm, n_silica)


if __name__ == '__main__':
    main()
