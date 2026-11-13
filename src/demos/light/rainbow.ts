import type { Face, Room } from './data'

/**
 * Continuous-spectrum room light, traced in the browser from the simulated grating.
 *
 * - Directions are exact: for normal incidence, order m leaves at sin(theta) = m * lambda / period.
 * - Strengths are the simulated RCWA order efficiencies (TE/TM mean), interpolated
 *   between the seven solved colours.
 * - The source is the same 5778 K sun-like spectrum shape, 1000 W/m^2 visible, through
 *   the same 60 cm x 2 cm slit; only the window's placement and tilt are chosen for the view.
 * - First landing points are exact ray/box intersections with the same room faces.
 */

export const LMIN = 400
export const LMAX = 700
const SAMPLES = 110
const SEGMENTS = 22
const FEATHER = 4 // stations over which each patch's ends fade in
const ORDERS = [-2, -1, 0, 1, 2]

export type Window = {
  tiltDeg: number // beam angle below horizontal
  center: [number, number, number]
  n: [number, number, number] // zero-order direction = window normal
  g: [number, number, number] // dispersion direction (across the grooves)
  a: [number, number, number] // slit long axis
  length: number
  width: number
}

export type RainbowBuild = {
  window: Window
  ribbons: { pos: Float32Array; tint: Float32Array; energy: Float32Array; lam: Float32Array; index: Uint32Array }
  rays: { pos: Float32Array; tint: Float32Array; s: Float32Array; lam: Float32Array; phase: Float32Array }
  budget: { label: string; watts: number }[]
  input: number
}

type V = [number, number, number]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

/** Window high on the far wall (y = W), tilted down toward the floor; grooves vertical. */
export function makeWindow(room: Room, tiltDeg: number): Window {
  const [L, W] = room.size
  const t = (tiltDeg * Math.PI) / 180
  const n: V = [0, -Math.cos(t), -Math.sin(t)]
  const g: V = [1, 0, 0]
  const a: V = [0, Math.sin(t), -Math.cos(t)] // g x n
  const length = room.window.width // 0.6 m, as simulated
  const width = room.window.height // 0.02 m
  const center: V = [L / 2, W - (length / 2) * Math.sin(t) - 0.03, 2.08]
  return { tiltDeg, center, n, g, a, length, width }
}

// ---------------------------------------------------------------- spectra

/** CIE 1931 colour matching, multi-lobe Gaussian fit (Wyman, Sloan & Shirley 2013). */
function cie(l: number): V {
  const g = (x: number, mu: number, s1: number, s2: number) => {
    const s = x < mu ? s1 : s2
    return Math.exp(-0.5 * ((x - mu) / s) ** 2)
  }
  return [
    1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)
  ]
}

/** Linear sRGB of a spectral line, desaturated into gamut; brightest channel 1. */
export function spectralRGB(l: number): V {
  const [x, y, z] = cie(l)
  let r = 3.2406 * x - 1.5372 * y - 0.4986 * z
  let g = -0.9689 * x + 1.8758 * y + 0.0415 * z
  let b = 0.0557 * x - 0.204 * y + 1.057 * z
  const lo = Math.min(0, r, g, b)
  r -= lo; g -= lo; b -= lo
  const m = Math.max(r, g, b) || 1
  return [r / m, g / m, b / m]
}

/** Relative 5778 K Planck spectral shape (same source shape as the simulation). */
function planck(lnm: number) {
  const l = lnm * 1e-9
  return 1 / (l ** 5 * (Math.exp(0.014388 / (l * 5778)) - 1))
}

/** Linear interpolation of a per-band quantity to wavelength l (clamped at the ends). */
function interp(room: Room, l: number, f: (band: number) => number) {
  const nm = room.bands.map((b) => b.nm)
  if (l <= nm[0]!) return f(0)
  if (l >= nm[nm.length - 1]!) return f(nm.length - 1)
  let i = 0
  while (nm[i + 1]! < l) i++
  const u = (l - nm[i]!) / (nm[i + 1]! - nm[i]!)
  return f(i) * (1 - u) + f(i + 1) * u
}

function efficiencyT(room: Room, b: number, m: number) {
  const [te, tm] = room.efficiency[b]!
  const i = te.orders.indexOf(m)
  return i < 0 ? 0 : (te.T[i]! + tm.T[i]!) / 2
}

function efficiencyR(room: Room, b: number) {
  const [te, tm] = room.efficiency[b]!
  return (te.R.reduce((s, v) => s + v, 0) + tm.R.reduce((s, v) => s + v, 0)) / 2
}

// ---------------------------------------------------------------- tracing

function hit(faces: Face[], o: V, d: V): { face: number; p: V; cos: number } | null {
  let best = Infinity
  let out: { face: number; p: V; cos: number } | null = null
  faces.forEach((f, i) => {
    const n = f.normal as V
    const den = dot(d, n)
    if (Math.abs(den) < 1e-12) return
    const t = dot([f.origin[0]! - o[0], f.origin[1]! - o[1], f.origin[2]! - o[2]], n) / den
    if (t <= 1e-6 || t >= best) return
    const p = add(o, d, t)
    const q: V = [p[0] - f.origin[0]!, p[1] - f.origin[1]!, p[2] - f.origin[2]!]
    if (Math.abs(dot(q, f.u as V)) > f.half[0]! + 1e-9 || Math.abs(dot(q, f.v as V)) > f.half[1]! + 1e-9) return
    best = t
    out = { face: i, p, cos: Math.abs(den) }
  })
  return out
}

function surfaceGroup(name: string) {
  if (name.startsWith('table')) return 'table'
  if (name.startsWith('cube')) return 'cube'
  if (name.startsWith('pedestal')) return 'sculpture & pedestal'
  return (
    { room_0_0: 'left wall', room_0_1: 'right wall', room_1_0: 'near wall', room_1_1: 'window wall', room_2_0: 'floor', room_2_1: 'ceiling' } as Record<string, string>
  )[name] ?? name
}

/**
 * Spectral table for shaders: for orders -2..2 (rows), rgb(lambda) * S(lambda) * T_m(lambda)
 * in W per nm, sampled at `n` wavelengths from LMIN to LMAX. S is the source power per nm.
 */
export function spectralTable(room: Room, input: number, n = 256) {
  const P = room.period * 1e9
  const dl = (LMAX - LMIN) / n
  const lams = Array.from({ length: n }, (_, i) => LMIN + (i + 0.5) * dl)
  const wsum = lams.reduce((s, l) => s + planck(l), 0) * dl
  const data = new Float32Array(n * ORDERS.length * 4)
  ORDERS.forEach((m, row) => {
    lams.forEach((l, i) => {
      const ok = Math.abs((m * l) / P) < 1
      const S = (input * planck(l)) / wsum
      const T = ok ? interp(room, l, (b) => efficiencyT(room, b, m)) : 0
      const rgb = spectralRGB(l)
      const k = 4 * (row * n + i)
      data[k] = rgb[0] * S * T; data[k + 1] = rgb[1] * S * T; data[k + 2] = rgb[2] * S * T; data[k + 3] = 1
    })
  })
  return { data, n, lmin: LMIN, lmax: LMAX }
}

export function buildRainbow(room: Room, tiltDeg: number, occluders: Face[] = []): RainbowBuild {
  const win = makeWindow(room, tiltDeg)
  const faces = [...room.faces, ...occluders]
  const drawn = room.faces.length // occluders block light but are lit by their own shader
  const P = room.period * 1e9 // nm
  const input = 1000 * win.length * win.width // W, visible band, as simulated
  const dl = (LMAX - LMIN) / SAMPLES
  const lams = Array.from({ length: SAMPLES }, (_, i) => LMIN + (i + 0.5) * dl)
  const wsum = lams.reduce((s, l) => s + planck(l), 0)
  const power = lams.map((l) => (input * planck(l)) / wsum) // W per sample

  const pos: number[] = [], tint: number[] = [], energy: number[] = [], lam: number[] = [], index: number[] = []
  const budget = new Map<string, number>()
  let reflected = 0

  type Hit = { face: number; p: V; cos: number } | null
  const dirOf = (m: number, l: number): V | null => {
    const s = (m * l) / P
    if (Math.abs(s) >= 1) return null
    const c = Math.sqrt(1 - s * s)
    return [c * win.n[0] + s * win.g[0], c * win.n[1] + s * win.g[1], c * win.n[2] + s * win.g[2]]
  }
  const along = (k: number) => add(win.center, win.a, (k / SEGMENTS - 0.5) * win.length)
  // Display: soften the ends of the slit's image so patches fade out like diffuse light.
  const feather = (k: number) => {
    const x = Math.min(1, Math.min(k, SEGMENTS - k) / FEATHER)
    return x * x * (3 - 2 * x)
  }
  const pushVertex = (h: NonNullable<Hit>, rgb: V, rho: number, e: number, l: number, lift: number) => {
    const f = faces[h.face]!
    pos.push(h.p[0] + f.normal[0]! * lift, h.p[1] + f.normal[1]! * lift, h.p[2] + f.normal[2]! * lift)
    tint.push(rgb[0] * rho, rgb[1] * rho, rgb[2] * rho)
    energy.push(Math.min(e, 4000))
    lam.push(l)
  }
  const rhoOf = (face: number, l: number) =>
    0.35 + 0.65 * interp(room, l, (b) => room.band_reflectance[faces[face]!.material]?.[b] ?? 0.7)

  lams.forEach((l, li) => {
    reflected += power[li]! * interp(room, l, (b) => efficiencyR(room, b))
    for (const m of ORDERS) {
      const d = dirOf(m, l)
      const T = interp(room, l, (b) => efficiencyT(room, b, m))
      if (!d || T < 1e-5) continue
      const mid = hit(faces, win.center, d)
      if (mid) {
        const key = surfaceGroup(faces[mid.face]!.name)
        budget.set(key, (budget.get(key) ?? 0) + power[li]! * T)
      }
    }
  })

  // Diffracted orders: one continuous sheet per order across wavelength x slit length.
  // Each patch between neighbouring wavelengths carries exactly that interval's power,
  // so E = power / patch area: no gaps at any distance, energy conserved.
  for (const m of ORDERS) {
    if (m === 0) continue
    const grid: Hit[][] = lams.map((l) => {
      const d = dirOf(m, l)
      return d ? Array.from({ length: SEGMENTS + 1 }, (_, k) => hit(faces, along(k), d)) : []
    })
    for (let i = 0; i + 1 < lams.length; i++) {
      const A = grid[i]!, B = grid[i + 1]!
      if (!A.length || !B.length) continue
      const la = lams[i]!, lb = lams[i + 1]!
      const pwa = power[i]! * interp(room, la, (b) => efficiencyT(room, b, m))
      const pwb = power[i + 1]! * interp(room, lb, (b) => efficiencyT(room, b, m))
      const strip = (pwa + pwb) / 2 / SEGMENTS // W carried by one patch
      const ca = spectralRGB(la), cb = spectralRGB(lb)
      for (let k = 0; k < SEGMENTS; k++) {
        const q = [A[k]!, B[k]!, A[k + 1]!, B[k + 1]!]
        if (q.some((h) => !h) || new Set(q.map((h) => h!.face)).size > 1 || q[0]!.face >= drawn) continue
        const [p0, p1, p2, p3] = q.map((h) => h!.p) as [V, V, V, V]
        const d1: V = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]]
        const d2: V = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]
        const cx = d1[1] * d2[2] - d1[2] * d2[1], cy = d1[2] * d2[0] - d1[0] * d2[2], cz = d1[0] * d2[1] - d1[1] * d2[0]
        const area = Math.max(1e-6, 0.5 * Math.hypot(cx, cy, cz))
        const e = strip / area
        const base = pos.length / 3
        const lift = 0.002 + (Math.abs(m) - 1) * 0.0004
        const f0 = feather(k), f1 = feather(k + 1)
        pushVertex(q[0]!, ca, rhoOf(q[0]!.face, la), e * f0, la, lift)
        pushVertex(q[1]!, cb, rhoOf(q[1]!.face, lb), e * f0, lb, lift)
        pushVertex(q[2]!, ca, rhoOf(q[2]!.face, la), e * f1, la, lift)
        pushVertex(q[3]!, cb, rhoOf(q[3]!.face, lb), e * f1, lb, lift)
        index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3)
      }
    }
  }

  // Zero order: every wavelength leaves straight on, so its colours add to white.
  {
    const d = win.n
    let tw = 0
    const white: V = [0, 0, 0]
    lams.forEach((l, li) => {
      const w = power[li]! * interp(room, l, (b) => efficiencyT(room, b, 0))
      const c = spectralRGB(l)
      tw += w
      white[0] += c[0] * w; white[1] += c[1] * w; white[2] += c[2] * w
    })
    const mx = Math.max(...white) || 1
    const rgb: V = [white[0] / mx, white[1] / mx, white[2] / mx]
    const rows = Array.from({ length: SEGMENTS + 1 }, (_, k) => [-0.5, 0.5].map((e) => hit(faces, add(along(k), win.g, e * win.width), d)))
    for (let k = 0; k < SEGMENTS; k++) {
      const q = [rows[k]![0]!, rows[k]![1]!, rows[k + 1]![0]!, rows[k + 1]![1]!]
      if (q.some((h) => !h) || new Set(q.map((h) => h!.face)).size > 1 || q[0]!.face >= drawn) continue
      const base = pos.length / 3
      q.forEach((h, j) => {
        const e = (tw / (win.length * win.width)) * h!.cos * feather(k + (j >> 1))
        pushVertex(h!, rgb, rhoOf(h!.face, 555), e, 555, 0.0025)
      })
      index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3)
    }
  }

  // Rays: a random sample weighted by power, origin on the slit -> first landing.
  const rpos: number[] = [], rtint: number[] = [], rs: number[] = [], rlam: number[] = [], rph: number[] = []
  let seed = 11
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const cdf: { l: number; m: number; w: number }[] = []
  let acc = 0
  lams.forEach((l, li) => {
    for (const m of ORDERS) {
      if (Math.abs((m * l) / P) >= 1) continue
      acc += power[li]! * interp(room, l, (b) => efficiencyT(room, b, m))
      cdf.push({ l, m, w: acc })
    }
  })
  for (let k = 0; k < 900; k++) {
    const r = rand() * acc
    const pick = cdf.find((e) => e.w >= r) ?? cdf[cdf.length - 1]!
    const l = pick.l + (rand() - 0.5) * dl
    const s = (pick.m * l) / P
    const c = Math.sqrt(1 - s * s)
    const d: V = [c * win.n[0] + s * win.g[0], c * win.n[1] + s * win.g[1], c * win.n[2] + s * win.g[2]]
    const o = add(add(win.center, win.a, (rand() - 0.5) * win.length), win.g, (rand() - 0.5) * win.width)
    const h = hit(faces, o, d)
    if (!h) continue
    const rgb = spectralRGB(l)
    rpos.push(...o, ...h.p)
    rtint.push(...rgb, ...rgb)
    const len = Math.hypot(h.p[0] - o[0], h.p[1] - o[1], h.p[2] - o[2])
    rs.push(0, len / 4)
    rlam.push(l, l)
    const ph = (k * 0.618) % 1
    rph.push(ph, ph)
  }

  const order = ['floor', 'sculpture & pedestal', 'cube', 'table', 'left wall', 'right wall', 'near wall', 'window wall', 'ceiling']
  const rows = order.filter((k) => (budget.get(k) ?? 0) > 1e-4).map((k) => ({ label: k, watts: budget.get(k)! }))
  rows.push({ label: 'back out the window', watts: reflected })

  return {
    window: win,
    ribbons: { pos: Float32Array.from(pos), tint: Float32Array.from(tint), energy: Float32Array.from(energy), lam: Float32Array.from(lam), index: Uint32Array.from(index) },
    rays: { pos: Float32Array.from(rpos), tint: Float32Array.from(rtint), s: Float32Array.from(rs), lam: Float32Array.from(rlam), phase: Float32Array.from(rph) },
    budget: rows,
    input
  }
}
