# AG landing

A preview site: the "Into The Unknown" hero, plus a Demos section with interactive
physics demos. Top-level sections and demos are registered in `src/site.ts`.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static output in dist/
```

Routes are hash-based (`#/`, `#/demos/<id>`), so `dist/` works on any static host.
three.js is loaded only with a demo; the hero page stays React-only.

## Hero clip

`public/media/unknown.{webm,mp4}` and `poster.jpg` come from
`ag-suite/sim-intro-video/out/film_full_clean.mp4` (104.5–114 s, 1 s fade in and out, no audio).

## Demos

| Demo | Status | Code | Data |
|---|---|---|---|
| 01 Light | placeholder | — | — |
| 02 Leaf | placeholder | — | — |
| 03 Glass | live | `src/demos/glass/` | `public/demos/glass/glass.json` |

Adding a demo: one entry in `DEMOS` (`src/site.ts`) with a `load` import, a module
under `src/demos/<id>/`, and its display bundle under `public/demos/<id>/`.

Each bundle holds only what the page draws or plays. It is exported from a saved
ag-physics result; the native data, receipts and setup never ship.

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
