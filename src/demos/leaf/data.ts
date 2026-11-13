/** Display bundle written by tools/export_leaf.py. SI units, z up (simulation frame). */
export type LeafBundle = {
  version: number
  rate: number
  frames: number
  duration: number
  clearance: number
  mesh: { xy: number[]; phi: number[]; faces: number[]; boundary: number[] }
  flight: { position: number[]; quaternion: number[]; eta: number[]; wind: number[] }
  breeze: { mean: number[]; amplitude: number[]; frequency: number[]; phase: number[] }
}

export async function loadLeaf(): Promise<LeafBundle> {
  const res = await fetch(`${import.meta.env.BASE_URL}demos/leaf/leaf.json`)
  if (!res.ok) throw new Error(`leaf data: HTTP ${res.status}`)
  return res.json()
}

export type Pose = {
  p: [number, number, number]
  q: [number, number, number, number] // wxyz
  eta: [number, number, number]
}

/**
 * Smooth sampling of the saved flight at any time: Catmull-Rom for position and
 * bending/twist, normalized slerp for orientation. The bundle is already dense,
 * so this only removes stepping at slow motion and high refresh rates.
 */
export class Flight {
  readonly n: number
  constructor(private b: LeafBundle) {
    this.n = b.frames
  }

  get duration() {
    return this.b.duration
  }

  time(k: number) {
    return Math.min(k / this.b.rate, this.b.duration)
  }

  sample(t: number, out?: Pose): Pose {
    const { rate } = this.b
    const f = Math.max(0, Math.min(this.n - 1.000001, t * rate))
    const k = Math.floor(f)
    const u = f - k
    const o = out ?? { p: [0, 0, 0], q: [1, 0, 0, 0], eta: [0, 0, 0] }
    cr(this.b.flight.position, 3, k, u, this.n, o.p)
    cr(this.b.flight.eta, 3, k, u, this.n, o.eta)
    slerp(this.b.flight.quaternion, k, u, o.q)
    return o
  }

  /** Raw sample k of a 3-vector series. */
  vec(series: 'position' | 'eta' | 'wind', k: number): [number, number, number] {
    const a = this.b.flight[series]
    const i = Math.max(0, Math.min(this.n - 1, k)) * 3
    return [a[i]!, a[i + 1]!, a[i + 2]!]
  }

  quat(k: number): [number, number, number, number] {
    const a = this.b.flight.quaternion
    const i = Math.max(0, Math.min(this.n - 1, k)) * 4
    return [a[i]!, a[i + 1]!, a[i + 2]!, a[i + 3]!]
  }
}

function cr(a: number[], d: number, k: number, u: number, n: number, out: number[]) {
  const i0 = Math.max(0, k - 1) * d
  const i1 = k * d
  const i2 = Math.min(n - 1, k + 1) * d
  const i3 = Math.min(n - 1, k + 2) * d
  const u2 = u * u
  const u3 = u2 * u
  for (let j = 0; j < d; j++) {
    const p0 = a[i0 + j]!, p1 = a[i1 + j]!, p2 = a[i2 + j]!, p3 = a[i3 + j]!
    out[j] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  }
}

function slerp(a: number[], k: number, u: number, out: number[]) {
  const i = k * 4
  const j = Math.min(k + 1, a.length / 4 - 1) * 4
  let w2 = a[j]!, x2 = a[j + 1]!, y2 = a[j + 2]!, z2 = a[j + 3]!
  const w1 = a[i]!, x1 = a[i + 1]!, y1 = a[i + 2]!, z1 = a[i + 3]!
  let dot = w1 * w2 + x1 * x2 + y1 * y2 + z1 * z2
  if (dot < 0) { dot = -dot; w2 = -w2; x2 = -x2; y2 = -y2; z2 = -z2 }
  let s1 = 1 - u
  let s2 = u
  if (dot < 0.9995) {
    const th = Math.acos(dot)
    const s = Math.sin(th)
    s1 = Math.sin((1 - u) * th) / s
    s2 = Math.sin(u * th) / s
  }
  const w = s1 * w1 + s2 * w2, x = s1 * x1 + s2 * x2, y = s1 * y1 + s2 * y2, z = s1 * z1 + s2 * z2
  const m = Math.hypot(w, x, y, z) || 1
  out[0] = w / m; out[1] = x / m; out[2] = y / m; out[3] = z / m
}

/** Prescribed breeze, uniform in space: U(t) = mean + sum_j A_ij sin(w_ij t + phi_ij). */
export function breeze(b: LeafBundle['breeze'], t: number, out: number[]) {
  for (let i = 0; i < 3; i++) {
    let u = b.mean[i]!
    for (let j = 0; j < 3; j++) {
      const k = i * 3 + j
      u += b.amplitude[k]! * Math.sin(b.frequency[k]! * t + b.phase[k]!)
    }
    out[i] = u
  }
  return out
}
