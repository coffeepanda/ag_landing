/** "In the air" bundle written by tools/export_leaf_air.py. SI units, z up. */
export type AirMeta = {
  version: number
  time: number[]
  box: { lo: number[]; hi: number[] }
  wind: number
  pitch_deg: number
  grid: { n: [number, number, number]; scale: number; offset: number; inside: number[] }
  slice: {
    n: [number, number]
    y: number
    speed_offset: number
    pressure_offset: number
    speed_scale: number
    pressure_scale: number
    speed_max: number
    pressure_range: [number, number]
  }
  leaf: {
    points: number[][]
    elastic: number[][]
    uv: number[]
    triangles: number[]
    quads: number
    cut: number[]
    frame: { center: number[]; span: number[]; chord: number[]; normal: number[]; half_span: number; half_chord: number }
  }
  history: { total: number[]; elastic: number[]; force: number[][] }
  field: { time: number; speed_max: number; pressure_range: [number, number]; tetrahedra: number }
}

export type Air = {
  meta: AirMeta
  velocity: Int16Array
  inside: Uint8Array
  speed: Int16Array
  pressure: Int16Array
}

export async function loadAir(): Promise<Air> {
  const base = import.meta.env.BASE_URL
  const [mr, br] = await Promise.all([fetch(`${base}demos/leaf/air.json`), fetch(`${base}demos/leaf/air.bin`)])
  if (!mr.ok || !br.ok) throw new Error(`air data: HTTP ${mr.status}/${br.status}`)
  const meta: AirMeta = await mr.json()
  const buf = await br.arrayBuffer()
  const [nx, ny, nz] = meta.grid.n
  const [sx, sz] = meta.slice.n
  const cells = nx * ny * nz
  const bits = Uint8Array.from(meta.grid.inside)
  const inside = new Uint8Array(cells)
  for (let i = 0; i < cells; i++) inside[i] = (bits[i >> 3]! >> (7 - (i & 7))) & 1
  return {
    meta,
    velocity: new Int16Array(buf, meta.grid.offset * 2, cells * 3),
    inside,
    speed: new Int16Array(buf, meta.slice.speed_offset * 2, sx * sz),
    pressure: new Int16Array(buf, meta.slice.pressure_offset * 2, sx * sz)
  }
}

/** Trilinear velocity at a point (m/s); returns false outside the air. */
export function sampleVelocity(a: Air, x: number, y: number, z: number, out: number[]): boolean {
  const { lo, hi } = a.meta.box
  const [nx, ny, nz] = a.meta.grid.n
  const fx = ((x - lo[0]!) / (hi[0]! - lo[0]!)) * nx - 0.5
  const fy = ((y - lo[1]!) / (hi[1]! - lo[1]!)) * ny - 0.5
  const fz = ((z - lo[2]!) / (hi[2]! - lo[2]!)) * nz - 0.5
  if (fx < -0.5 || fy < -0.5 || fz < -0.5 || fx > nx - 0.5 || fy > ny - 0.5 || fz > nz - 0.5) return false
  const cx = Math.max(0, Math.min(nx - 1.0001, fx))
  const cy = Math.max(0, Math.min(ny - 1.0001, fy))
  const cz = Math.max(0, Math.min(nz - 1.0001, fz))
  const i = Math.floor(cx), j = Math.floor(cy), k = Math.floor(cz)
  const u = cx - i, v = cy - j, w = cz - k
  out[0] = out[1] = out[2] = 0
  let weight = 0
  for (let dk = 0; dk < 2; dk++)
    for (let dj = 0; dj < 2; dj++)
      for (let di = 0; di < 2; di++) {
        const idx = ((i + di) * ny + (j + dj)) * nz + (k + dk)
        if (!a.inside[idx]) continue
        const wt = (di ? u : 1 - u) * (dj ? v : 1 - v) * (dk ? w : 1 - w)
        weight += wt
        out[0] += wt * a.velocity[3 * idx]!
        out[1] += wt * a.velocity[3 * idx + 1]!
        out[2] += wt * a.velocity[3 * idx + 2]!
      }
  if (weight < 0.25) return false
  const s = a.meta.grid.scale / weight
  out[0] *= s; out[1] *= s; out[2] *= s
  return true
}

/**
 * Speed relative to the breeze, for drawing over a dark scene: undisturbed air is
 * nearly black (transparent under additive blending), slower air teal, faster gold.
 */
export function deltaColor(speed: number, breeze: number, max: number, out: number[]) {
  const t = speed >= breeze ? (speed - breeze) / Math.max(1e-6, max - breeze) : (speed - breeze) / breeze
  const m = Math.pow(Math.min(1, Math.abs(t)), 0.7)
  const c = t >= 0 ? [0.95, 0.74, 0.42] : [0.22, 0.62, 0.72]
  out[0] = c[0]! * m; out[1] = c[1]! * m; out[2] = c[2]! * m
  return out
}

export function pressureColor(t: number, out: number[]) {
  // t in [-1, 1]: negative (suction) cool blue, positive amber.
  const m = Math.min(1, Math.abs(t))
  const c = t < 0 ? [0.32, 0.55, 0.95] : [0.98, 0.58, 0.28]
  out[0] = c[0]! * m; out[1] = c[1]! * m; out[2] = c[2]! * m
  return out
}
