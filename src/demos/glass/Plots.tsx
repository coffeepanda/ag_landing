import { useEffect, useMemo, useRef } from 'react'
import { Figure } from '../../components/BehindPanel'
import type { Glass } from './data'

type Focus = { i: number; tau: number } | null

const GOLD = '217,185,138'
const INK = '244,239,230'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const DB_RANGE = 60
const LIVE_FOR = 7 // s after a strike that plots follow it

/**
 * Live plots behind the Singing Glass. Each follows the most recent strike:
 * spectrum, water vs pitch, ring shapes, and mallet contact force.
 */
export default function GlassPlots({
  glasses,
  strikeUs,
  getFocus,
  open
}: {
  glasses: Glass[]
  strikeUs: number[]
  getFocus: () => Focus
  open: boolean
}) {
  const spec = useRef<HTMLCanvasElement>(null)
  const water = useRef<HTMLCanvasElement>(null)
  const shapes = useRef<HTMLCanvasElement>(null)
  const force = useRef<HTMLCanvasElement>(null)
  const last = useRef(0)

  const stats = useMemo(() => summarize(glasses, strikeUs), [glasses, strikeUs])

  useEffect(() => {
    if (!open || !glasses.length) return
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const f = getFocus()
      const live = !!f && f.tau < LIVE_FOR
      if (live) last.current = f.i
      const i = last.current
      const tau = live ? f.tau : 0
      if (spec.current) drawSpectrum(spec.current, glasses, stats, i, tau, live)
      if (water.current) drawWater(water.current, glasses, stats, i, live ? Math.exp(-glasses[i]!.modes[0]!.gamma * tau) : 0)
      if (shapes.current) drawShapes(shapes.current, stats, i, tau, live)
      if (force.current) drawForce(force.current, glasses, strikeUs, stats, i, tau, live)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [open, glasses, strikeUs, stats, getFocus])

  return (
    <div className="figs">
      <Figure title="Spectrum" caption="Each bar is one way the struck glass rings. The higher ones fade first.">
        <canvas ref={spec} className="fig-canvas" style={{ height: 118 }} />
      </Figure>
      <Figure title="Water and pitch" caption="Two bowl shapes cover the octave. Within each, more water gives a lower note.">
        <canvas ref={water} className="fig-canvas" style={{ height: 128 }} />
      </Figure>
      <Figure title="Ring shapes" caption="The rim rings in 2, 3, 4… lobes at once. The strike sets how much of each you hear.">
        <canvas ref={shapes} className="fig-canvas" style={{ height: 92 }} />
      </Figure>
      <Figure title="The strike" caption="Mallet contact force. The whole strike is over in about forty microseconds.">
        <canvas ref={force} className="fig-canvas" style={{ height: 104 }} />
      </Figure>
    </div>
  )
}

// ---------------------------------------------------------------- data

type Order = { n: number; amp: number; gamma: number; f: number }
type Stats = ReturnType<typeof summarize>

function summarize(glasses: Glass[], strikeUs: number[]) {
  const allF = glasses.flatMap((g) => g.modes.map((m) => m.f))
  const wMax = Math.max(...glasses.flatMap((g) => g.modes.map((m) => Math.abs(m.w))))
  const orders = glasses.map((g) => {
    const by = new Map<number, Order>()
    for (const m of g.modes) {
      const o = by.get(m.n) ?? { n: m.n, amp: 0, gamma: 0, f: 0 }
      o.amp += m.c * m.c + m.s * m.s
      o.gamma = Math.max(o.gamma, m.gamma)
      o.f = Math.max(o.f, m.f)
      by.set(m.n, o)
    }
    const list = [...by.values()].sort((a, b) => a.n - b.n)
    list.forEach((o) => (o.amp = Math.sqrt(o.amp)))
    return list
  })
  const strikes = glasses.map((g) => {
    let end = 0
    g.strike.forEach((v, k) => v > 0 && (end = k))
    return { peak: Math.max(...g.strike), duration: strikeUs[Math.min(end + 1, strikeUs.length - 1)] ?? 0 }
  })
  // Bowl designs in order of first appearance.
  const shapeIds = [...new Set(glasses.map((g) => g.shape))]
  return {
    fMin: 350,
    fMax: Math.max(...allF) * 1.15,
    wMax,
    orders,
    strikes,
    shapeIds,
    fMaxForce: Math.max(...strikes.map((s) => s.peak)) * 1.12,
    depthMax: Math.ceil((Math.max(...glasses.map((g) => g.depth)) * 1000) / 20) * 20
  }
}

// ---------------------------------------------------------------- drawing

function prep(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = c.clientWidth
  const h = c.clientHeight
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  g.font = `9px ${MONO}`
  g.textBaseline = 'alphabetic'
  return { g, w, h }
}

const ink = (a: number) => `rgba(${INK},${a})`
const gold = (a: number) => `rgba(${GOLD},${a})`

function hz(f: number) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`
}

function drawSpectrum(c: HTMLCanvasElement, glasses: Glass[], s: Stats, i: number, tau: number, live: boolean) {
  const { g, w, h } = prep(c)
  const L = 4, R = 4, T = 22, B = 16
  const pw = w - L - R
  const ph = h - T - B
  const x = (f: number) => L + (Math.log(f / s.fMin) / Math.log(s.fMax / s.fMin)) * pw
  const base = T + ph

  // dB grid
  g.strokeStyle = ink(0.07)
  g.lineWidth = 1
  for (const db of [0, -20, -40]) {
    const y = T + (-db / DB_RANGE) * ph
    g.beginPath(); g.moveTo(L, y + 0.5); g.lineTo(w - R, y + 0.5); g.stroke()
  }
  g.strokeStyle = ink(0.22)
  g.beginPath(); g.moveTo(L, base + 0.5); g.lineTo(w - R, base + 0.5); g.stroke()

  g.fillStyle = ink(0.35)
  g.textAlign = 'center'
  for (const f of [500, 1000, 2000, 5000, 10000]) {
    if (f > s.fMax) continue
    g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f), h - 3)
  }

  const glass = glasses[i]!
  for (const m of glass.modes) {
    const amp = Math.abs(m.w) * Math.exp(-m.gamma * tau)
    const db = 20 * Math.log10(Math.max(amp, 1e-30) / s.wMax)
    const k = Math.max(0, Math.min(1, (db + DB_RANGE) / DB_RANGE))
    const xx = Math.round(x(m.f)) + 0.5
    g.strokeStyle = live ? gold(0.35 + 0.65 * k) : ink(0.3)
    g.lineWidth = 2
    g.beginPath(); g.moveTo(xx, base); g.lineTo(xx, base - k * ph); g.stroke()
    if (k > 0.02) {
      g.fillStyle = live ? gold(0.9) : ink(0.4)
      g.beginPath(); g.arc(xx, base - k * ph, 1.8, 0, Math.PI * 2); g.fill()
    }
  }

  g.textAlign = 'left'
  g.fillStyle = live ? gold(1) : ink(0.55)
  g.font = `10px ${MONO}`
  g.fillText(`${glass.note} · ${hz(glass.modes[0]!.f)}`, L, 11)
  g.textAlign = 'right'
  g.fillStyle = ink(0.3)
  g.font = `9px ${MONO}`
  g.fillText(`0 to −${DB_RANGE} dB`, w - R, 11)
}

function drawWater(c: HTMLCanvasElement, glasses: Glass[], s: Stats, focus: number, level: number) {
  const { g, w, h } = prep(c)
  const L = 26, R = 6, T = 20, B = 18
  const pw = w - L - R
  const ph = h - T - B
  const x = (i: number) => L + (i / (glasses.length - 1)) * pw
  const y = (mm: number) => T + ph - (mm / s.depthMax) * ph

  g.strokeStyle = ink(0.07)
  g.fillStyle = ink(0.35)
  g.textAlign = 'right'
  for (let mm = 0; mm <= s.depthMax; mm += 20) {
    g.beginPath(); g.moveTo(L, y(mm) + 0.5); g.lineTo(w - R, y(mm) + 0.5); g.stroke()
    g.fillText(`${mm}`, L - 6, y(mm) + 3)
  }
  g.textAlign = 'left'
  g.fillText('mm', 0, 11)

  // One curve per bowl design.
  s.shapeIds.forEach((sid) => {
    g.strokeStyle = ink(0.22)
    g.lineWidth = 1
    g.beginPath()
    let started = false
    glasses.forEach((gl, i) => {
      if (gl.shape !== sid) return
      const px = x(i), py = y(gl.depth * 1000)
      if (started) g.lineTo(px, py)
      else { g.moveTo(px, py); started = true }
    })
    g.stroke()
  })

  glasses.forEach((gl, i) => {
    const px = x(i), py = y(gl.depth * 1000)
    const filled = s.shapeIds.indexOf(gl.shape) === 0
    const on = i === focus
    if (on && level > 0.01) {
      g.strokeStyle = gold(0.5 * level)
      g.beginPath(); g.arc(px, py, 5 + 10 * (1 - level), 0, Math.PI * 2); g.stroke()
    }
    g.lineWidth = 1.2
    g.strokeStyle = on ? gold(1) : ink(0.6)
    g.fillStyle = on ? gold(1) : ink(0.6)
    g.beginPath(); g.arc(px, py, on ? 4 : 2.8, 0, Math.PI * 2)
    if (filled) g.fill()
    else g.stroke()
  })

  g.textAlign = 'center'
  glasses.forEach((gl, i) => {
    g.fillStyle = i === focus ? gold(1) : ink(0.35)
    if (i % 2 === 0 || i === focus) g.fillText(gl.note, x(i), h - 3)
  })

  // Legend
  g.textAlign = 'right'
  g.fillStyle = ink(0.45)
  g.fillText('bowl A', w - R - 52, 11)
  g.fillText('bowl B', w - R, 11)
  g.fillStyle = ink(0.6)
  g.strokeStyle = ink(0.6)
  g.beginPath(); g.arc(w - R - 90, 8, 2.8, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(w - R - 38, 8, 2.8, 0, Math.PI * 2); g.stroke()
}

function drawShapes(c: HTMLCanvasElement, s: Stats, i: number, tau: number, live: boolean) {
  const { g, w, h } = prep(c)
  const orders = s.orders[i]!
  const cells = orders.length
  const cw = w / cells
  const r0 = Math.min(cw, h - 26) / 2 - 7
  const top = Math.max(...orders.map((o) => o.amp))
  const f2 = orders[0]!.f

  orders.forEach((o, k) => {
    const cx = cw * k + cw / 2
    const cy = r0 + 7
    const share = live ? (o.amp / top) * Math.exp(-o.gamma * tau) : 0
    const fv = 2.4 * Math.pow(o.f / f2, 0.45)
    const d = live ? 0.1 + 0.24 * Math.min(1, share * 1.6) * Math.sin(2 * Math.PI * fv * tau) : 0.12

    g.setLineDash([2, 3])
    g.strokeStyle = ink(0.15)
    g.lineWidth = 1
    g.beginPath(); g.arc(cx, cy, r0, 0, Math.PI * 2); g.stroke()
    g.setLineDash([])

    const glow = live ? Math.min(1, share * 1.6) : 0
    g.strokeStyle = live ? gold(0.3 + 0.7 * glow) : ink(0.45)
    g.lineWidth = 1.4
    g.beginPath()
    for (let a = 0; a <= 96; a++) {
      const th = (a / 96) * Math.PI * 2
      const r = r0 * (1 + d * Math.cos(o.n * th))
      const px = cx + r * Math.sin(th)
      const py = cy - r * Math.cos(th)
      if (a) g.lineTo(px, py)
      else g.moveTo(px, py)
    }
    g.stroke()

    g.textAlign = 'center'
    g.fillStyle = live && glow > 0.3 ? gold(0.9) : ink(0.45)
    g.fillText(`${o.n} lobes`, cx, h - 13)
    g.fillStyle = ink(0.3)
    g.fillText(hz(o.f), cx, h - 2)
  })
}

function drawForce(c: HTMLCanvasElement, glasses: Glass[], us: number[], s: Stats, i: number, tau: number, live: boolean) {
  const { g, w, h } = prep(c)
  const L = 4, R = 6, T = 20, B = 16
  const pw = w - L - R
  const ph = h - T - B
  const tMax = us[us.length - 1]!
  const x = (t: number) => L + (t / tMax) * pw
  const y = (f: number) => T + ph - (f / s.fMaxForce) * ph

  g.strokeStyle = ink(0.22)
  g.beginPath(); g.moveTo(L, T + ph + 0.5); g.lineTo(w - R, T + ph + 0.5); g.stroke()
  g.fillStyle = ink(0.35)
  g.textAlign = 'center'
  for (const t of [0, 20, 40, 60]) if (t <= tMax) g.fillText(`${t}`, Math.min(Math.max(x(t), 8), w - 14), h - 3)
  g.textAlign = 'right'
  g.fillText('µs', w - R, T + ph - 4)

  const line = (f: number[], n = f.length) => {
    g.beginPath()
    for (let k = 0; k < n; k++) {
      const px = x(us[k]!), py = y(f[k]!)
      if (k) g.lineTo(px, py)
      else g.moveTo(px, py)
    }
    g.stroke()
  }
  g.lineWidth = 1
  g.strokeStyle = ink(0.1)
  glasses.forEach((gl, k) => k !== i && line(gl.strike))

  // The focused strike draws itself in just after it happens.
  const progress = live ? Math.min(1, tau / 0.5) : 1
  g.lineWidth = 1.6
  g.strokeStyle = live ? gold(1) : ink(0.6)
  line(glasses[i]!.strike, Math.max(2, Math.round(progress * us.length)))

  const st = s.strikes[i]!
  g.textAlign = 'left'
  g.fillStyle = live ? gold(1) : ink(0.55)
  g.font = `10px ${MONO}`
  g.fillText(`peak ${st.peak.toFixed(2)} N · ${Math.round(st.duration)} µs`, L, 11)
}
