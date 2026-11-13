/** Bundles written by tools/export_light.py. Room frame: light enters along +x, z up, metres. */

export type Band = { nm: number; rgb: [number, number, number]; weight: number }

export type Face = {
  name: string
  material: string
  origin: number[]
  normal: number[]
  u: number[]
  v: number[]
  half: number[]
}

export type Efficiency = { orders: number[]; T: number[]; R: number[] }

export type Room = {
  version: number
  size: [number, number, number]
  window: { y: number; z: number; width: number; height: number }
  period: number
  materials: Record<string, [number, number, number]>
  band_reflectance: Record<string, number[]>
  bands: Band[]
  faces: Face[]
  efficiency: [Efficiency, Efficiency][] // per band: [TE, TM]
}

export type WaveMeta = {
  version: number
  period: number
  depth: number
  fill: number
  ridge_center: number
  nx: number
  nz: number
  z: [number, number]
  bands: { nm: number; n_silica: number }[]
  scale: number
}

export type Wave = { meta: WaveMeta; field: Int16Array }

const base = () => import.meta.env.BASE_URL

let roomPromise: Promise<Room> | null = null
export function loadRoom(): Promise<Room> {
  roomPromise ??= fetch(`${base()}demos/light/room.json`).then((r) => {
    if (!r.ok) throw new Error(`room data: HTTP ${r.status}`)
    return r.json()
  })
  return roomPromise
}

export async function loadWave(): Promise<Wave> {
  const [m, b] = await Promise.all([fetch(`${base()}demos/light/wave.json`), fetch(`${base()}demos/light/wave.bin`)])
  if (!m.ok || !b.ok) throw new Error(`wave data: HTTP ${m.status}/${b.status}`)
  return { meta: await m.json(), field: new Int16Array(await b.arrayBuffer()) }
}

/** CC0 Head of Doryphoros (plaster cast scan), metres, y up, base at y = 0. */
export type Sculpture = { size: [number, number, number]; positions: Float32Array; index: Uint16Array; source: string }

export async function loadSculpture(): Promise<Sculpture> {
  const [m, b] = await Promise.all([fetch(`${base()}demos/light/sculpture.json`), fetch(`${base()}demos/light/sculpture.bin`)])
  if (!m.ok || !b.ok) throw new Error(`sculpture: HTTP ${m.status}/${b.status}`)
  const meta = await m.json()
  const buf = await b.arrayBuffer()
  const q = new Int16Array(buf, 0, meta.vertices * 3)
  const index = new Uint16Array(buf, meta.vertices * 6, meta.triangles * 3)
  const [sx, sy, sz] = meta.size as [number, number, number]
  const positions = new Float32Array(meta.vertices * 3)
  for (let i = 0; i < meta.vertices; i++) {
    positions[3 * i] = (q[3 * i]! / 32767 / 0.999) * (sx / 2)
    positions[3 * i + 1] = (q[3 * i + 1]! / 32767) * sy
    positions[3 * i + 2] = (q[3 * i + 2]! / 32767 / 0.999) * (sz / 2)
  }
  return { size: meta.size, positions, index, source: meta.source }
}

/** sRGB-encoded CSS colour from a linear rgb triple. */
export function css(rgb: number[], a = 1) {
  const enc = (c: number) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))
  return `rgba(${enc(rgb[0]!)},${enc(rgb[1]!)},${enc(rgb[2]!)},${a})`
}

/** Diffraction angle (degrees from the window normal) of order m, or null if it doesn't propagate. */
export function orderAngle(m: number, nm: number, period: number) {
  const s = (m * nm * 1e-9) / period
  return Math.abs(s) < 1 ? (Math.asin(s) * 180) / Math.PI : null
}
