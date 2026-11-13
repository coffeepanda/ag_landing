# AG landing

A preview site: the "Into The Unknown" hero, plus a Phenomena section with
interactive physics demos. Top-level sections and demos are registered in `src/site.ts`.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static output in dist/
```

Routes are hash-based (`#/`, `#/phenomena/<id>`; `#/demos/<id>` still works as an
alias), so `dist/` works on any static host.
three.js is loaded only with a demo; the hero page stays React-only.

## Hero clip

`public/media/unknown.{webm,mp4}` and `poster.jpg` come from
`ag-suite/sim-intro-video/out/film_full_clean.mp4` (104.5–114 s, 1 s fade in and out, no audio).

## Phenomena

| Phenomenon | Status | Code | Data |
|---|---|---|---|
| 01 Light | live | `src/demos/light/` | `public/demos/light/` |
| 02 Leaf | live | `src/demos/leaf/` | `public/demos/leaf/leaf.json` |
| 03 Glass | live | `src/demos/glass/` | `public/demos/glass/glass.json` |

Adding a demo: one entry in `DEMOS` (`src/site.ts`) with a `load` import, a module
under `src/demos/<id>/`, and its display bundle under `public/demos/<id>/`.

Each bundle holds only what the page draws or plays. It is exported from a saved
ag-physics result; the native data, receipts and setup never ship.

Each phenomenon has a **Behind the scene** panel (`src/components/BehindPanel.tsx`),
open by default on wide screens and closed on phones (`useBehindPanel()`); `usePanelInset()` lets the scene re-centre
into the area the panel leaves uncovered. The panel shows
what is simulated, what is assumed, and two to four live plots that follow what the
visitor does. It stays at that level: results and honest assumptions, no solver,
module or numerical-method detail.

### Singing Glass bundle

Source: a completed `singing_glass.final_scale` result (the canonical
`demos/05-singing-glass/assets/final/native`, or a fresh reference run). Export with
the ag-physics environment (NumPy only, no engine import):

```powershell
python -I tools/export_glass.py <ag-physics>/demos/05-singing-glass/assets/final/native
```

The exporter checks that its closed-form modal synthesis matches each note's saved
sonification before writing. The page plays the same ten-mode sum per glass with one
common gain. The visual rim motion uses the saved mode shapes and real-time decay,
with amplitude exaggerated and oscillation slowed so it can be seen.

Its Behind-the-scene plots (`src/demos/glass/Plots.tsx`): the struck glass's
spectrum (each mode decaying at its own rate), water depth against pitch for both
bowl designs, the 2–6-lobe ring shapes, and the mallet contact force (~40 µs).

### Singing Glass: "Up close"

A switch on the glass page (*The set* / *Up close*) opens one glass with its simulated
physics, from the same `final_scale` result:

```powershell
python tools/export_glass_closeup.py <ag-physics>/demos/05-singing-glass/runs/<final-scale-result>
```

(with ag-physics on `PYTHONPATH` the exporter also cross-checks the pressure against the
case's own `simulation._pressure`; it writes `public/demos/glass/closeup.json` and one
`public/demos/glass/air/NN.bin` per glass, fetched only when that glass is shown.)

- **Wall field:** each mode's displacement is rebuilt from the model's prescribed basis
  `(z/H)^2 [cos/sin(n theta) e_r + tangential/n]` and its saved mass-normalised eigenvector
  (the exporter checks the analytic basis against the saved one, ~3e-15). The bowl
  moves by this field and is coloured by radial displacement; motion is magnified ~×1 000.
- **Strike:** the saved mallet contact (60 µs window: force, mallet position and all 10
  modal coordinates) replays 40 000× slower; the glass then rings with the released
  amplitudes, phases and decay rates, 800× slower, at true pitch ratios.
- **Air:** the radiated pressure of each mode on a horizontal slice through the bowl,
  from the case's surface-source surrogate `p = -rho w^2/(4 pi) sum A v_n e^{ikR}/R` over the
  1 280 saved wall patches (matches `simulation._pressure` to ~5e-16). The page combines
  the modes with the same phasors as the wall, so sound and motion stay in step.
- **Plots** (`ClosePlots.tsx`): strike force, how each ring shape builds during the
  contact, energy per ring shape, and an RMS pressure map ("sound around the glass").

### Last Leaf bundle

Source: a completed `leaf_fall.flexible` natural-leaf flight (the canonical
`demos/01-last-leaf/assets/natural-ode/selected/native`, or a fresh run with
`--set model.shape=leaf --set numerics.strips=32 --set numerics.chord_points=18 --set numerics.max_step=0.002`):

```powershell
python -I tools/export_leaf.py <ag-physics>/demos/01-last-leaf/assets/natural-ode/selected/native
```

It resamples the flight at 120 Hz from the saved states and rates (cubic Hermite,
orientation slerp) and checks the result passes through every saved position. The
page replays it with Catmull-Rom/slerp interpolation, deforms the saved 225-vertex
leaf by its three bending/twist shapes at true scale, and drifts dust motes with the
same prescribed breeze. The ground sits at the flight's end clearance, so the leaf
touches down as the simulated flight ends. Colour and veins are painted art.

Plots (`src/demos/leaf/Plots.tsx`, drag to scrub): the path down, bend and twist,
speed against the breeze, and rocking (tilt from flat). Playback is slow motion (¼×)
by default.

### Last Leaf: "In the air" close-up

A switch on the leaf page (*The fall* / *In the air*) opens a close-up of a separate
experiment: the resolved shell/air FSI startup (same leaf outline, 20° tilt, 0.3 m/s
breeze switched on at once, six accepted 1 ms steps). Source: a completed
`leaf_fall.fsi_snapshot` reference result (canonical
`demos/01-last-leaf/assets/fsi-natural/selected/native`, or a fresh
`leaf_fall.fsi_budget ... --profile reference --outline leaf --leaf-chord-cells 8 --leaf-span-cells 24 --mesh-size .04` run, ~35 min):

```powershell
python -I tools/export_leaf_air.py <ag-physics>/demos/01-last-leaf/assets/fsi-natural/selected/native
```

It evaluates the saved P2 air velocity / P1 pressure with the solver's own shape
functions on a regular 40×40×24 grid and on a slice through the leaf (int16 in
`public/demos/leaf/air.bin`, metadata in `air.json`), and exports the shell at every
accepted step with its elastic part after a rigid fit. The page streams particles
through the frozen 6 ms field (slowed), shows the speed or pressure slice, and can
magnify the leaf's elastic bending ×100. Plots (`AirPlots.tsx`): slice speed and
pressure with the leaf's cross-section, how the leaf gives way, and the air's push.

### Room of Light bundle

Source: the `room_light` reference grating solved with the README's wide-slit room
stage (`aperture_width=0.6`, reusing the same grating). Export with ag-physics on
`PYTHONPATH` (the grating field is sampled from the saved RCWA reconstruction payload):

```powershell
python tools/export_light.py <ag-physics>/demos/03-room-of-light/runs/<wide-slit-result>
```

Two views share one colour selection:

- **The grating**: the exact time-harmonic TE field `Re(Ey e^{-iwt})` over one period,
  for each of the seven solved colours, in a WebGL shader. Inside the ridged layer it is
  sampled from the saved reconstruction; in the glass and air it is the Rayleigh sum of
  all saved complex order amplitudes. The exporter checks the two agree at both faces
  (about 1e-14). "White" draws all seven together, each at its own rhythm.
- **The room**: a continuous-spectrum rainbow traced in the browser
  (`src/demos/light/rainbow.ts`). Angles are exact from the grating equation; order
  strengths are the simulated RCWA efficiencies (TE/TM mean) interpolated between the
  seven colours; the source is the same 5778 K shape through the same 60 cm × 2 cm slit.
  The window is placed high on the far wall and tilted for the view (light still meets
  the grating straight on); "Sun height" tilts it live. Each diffracted order is one
  energy-conserving sheet across wavelength; the sculpture and pedestal are lit per
  pixel by the exact wavelength interval the slit admits. Bloom is display only.

Sculpture: CC0 *Head of Doryphoros* plaster-cast scan (Museum of the Academy of Fine
Arts in Kraków, via Wirtualne Muzea Małopolski; Zenodo record 21530396). Converted with
`node tools/export_sculpture.mjs <…_normalized-0.250.glb>` (checksum-verified, Draco decoded
with three's bundled decoder, textures dropped) into `public/demos/light/sculpture.bin`.

