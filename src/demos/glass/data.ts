/** Display bundle written by tools/export_glass.py. Units: SI (m, Hz, 1/s). */
export type Mode = {
  f: number      // damped frequency
  gamma: number  // decay rate: exp(-gamma t)
  phase: number  // sin(2 pi f t + phase)
  n: number      // circumferential order
  c: number      // rim radial amplitude, cos(n theta)
  s: number      // rim radial amplitude, sin(n theta)
  w: number      // sound weight (rim readout)
}

export type Glass = {
  note: string
  midi: number
  shape: number
  radius: number
  height: number
  thickness: number
  depth: number
  modes: Mode[]
}

export type GlassSet = { version: number; glasses: Glass[] }

export async function loadGlassSet(): Promise<GlassSet> {
  const res = await fetch(`${import.meta.env.BASE_URL}demos/glass/glass.json`)
  if (!res.ok) throw new Error(`glass data: HTTP ${res.status}`)
  return res.json()
}
