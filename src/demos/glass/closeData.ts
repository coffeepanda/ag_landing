/** Display time scales: the 60 us contact window is replayed 40 000x slower, the ringing 800x. */
export const WINDOW_US = 60
export const SLOW_STRIKE = 40000
export const SLOW_RING = 800
export const RIM_VISUAL = 0.0035 // m: on-screen bound of rim excursion

/** "Up close" bundle written by tools/export_glass_closeup.py (SI units). */
export type CloseMode = { f: number; gamma: number; amp: number; phase: number; n: number; c: number; s: number }

export type CloseGlass = {
  note: string
  radius: number
  height: number
  thickness: number
  depth: number
  modes: CloseMode[]
  family: { order: number[]; energy: number[]; frequency: number[] }
  contact: { t_us: number[]; force: number[]; mallet: number[]; overlap: number[]; q: number[]; end_us: number; peak_force: number }
  strike_angle: number
  readout_angle: number
}

export type CloseBundle = { version: number; glasses: CloseGlass[]; mallet: { mass_kg: number; speed_m_s: number; stiffness_N_m: number } }

export async function loadClose(): Promise<CloseBundle> {
  const res = await fetch(`${import.meta.env.BASE_URL}demos/glass/closeup.json`)
  if (!res.ok) throw new Error(`close-up data: HTTP ${res.status}`)
  return res.json()
}

/** Largest possible rim excursion (m): sum over modes of amplitude x shape size. */
export function rimBound(g: CloseGlass) {
  return g.modes.reduce((a, m) => a + Math.abs(m.amp) * Math.hypot(m.c, m.s), 0)
}

/** Modal coordinates during the saved contact window, linearly interpolated (t in us). */
export function contactQ(g: CloseGlass, tUs: number, out: number[]) {
  const t = g.contact.t_us
  const nm = g.modes.length
  const k = Math.max(0, Math.min(t.length - 2, Math.floor((tUs / t[t.length - 1]!) * (t.length - 1))))
  const u = Math.max(0, Math.min(1, (tUs - t[k]!) / (t[k + 1]! - t[k]!)))
  for (let j = 0; j < nm; j++) out[j] = g.contact.q[k * nm + j]! * (1 - u) + g.contact.q[(k + 1) * nm + j]! * u
  return out
}

export function contactAt(series: number[], t: number[], tUs: number) {
  const k = Math.max(0, Math.min(t.length - 2, Math.floor((tUs / t[t.length - 1]!) * (t.length - 1))))
  const u = Math.max(0, Math.min(1, (tUs - t[k]!) / (t[k + 1]! - t[k]!)))
  return series[k]! * (1 - u) + series[k + 1]! * u
}
