import { useEffect, useMemo, useRef } from 'react'
import { Figure } from '../../components/BehindPanel'
import type { LeafBundle } from './data'

const GOLD = '217,185,138'
const INK = '244,239,230'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const ink = (a: number) => `rgba(${INK},${a})`
const gold = (a: number) => `rgba(${GOLD},${a})`

type Series = { v: Float32Array; color: (a: number) => string; dash?: number[]; label: string }

/**
 * Live plots behind the Last Leaf, all following the playhead:
 * the path down, bending and twist, speed against the breeze, and rocking.
 * Dragging across a time plot scrubs the flight.
 */
export default function LeafPlots({
  bundle,
  getTime,
  onSeek,
  open
}: {
  bundle: LeafBundle | null
  getTime: () => number
  onSeek: (t: number) => void
  open: boolean
}) {
  const path = useRef<HTMLCanvasElement>(null)
  const flex = useRef<HTMLCanvasElement>(null)
  const speed = useRef<HTMLCanvasElement>(null)
  const rock = useRef<HTMLCanvasElement>(null)
  const d = useMemo(() => (bundle ? derive(bundle) : null), [bundle])

  useEffect(() => {
    if (!open || !d) return
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const t = getTime()
      if (path.current) drawPath(path.current, d, t)
      if (flex.current) drawSeries(flex.current, d, t, d.flex, 'mm', [-d.flexMax, d.flexMax])
      if (speed.current) drawSeries(speed.current, d, t, d.speed, 'm/s', [Math.min(0, d.speedMin), d.speedMax])
      if (rock.current) drawSeries(rock.current, d, t, d.rock, '°', [0, 90])
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [open, d, getTime])

  // Scrub: drag across any time plot.
  useEffect(() => {
    if (!d) return
    const els = [flex.current, speed.current, rock.current].filter(Boolean) as HTMLCanvasElement[]
    const offs: (() => void)[] = []
    for (const el of els) {
      let down = false
      const at = (e: PointerEvent) => {
        const r = el.getBoundingClientRect()
        const u = (e.clientX - r.left - PAD.L) / (r.width - PAD.L - PAD.R)
        onSeek(Math.max(0, Math.min(1, u)) * d.duration)
      }
      const dn = (e: PointerEvent) => { down = true; el.setPointerCapture(e.pointerId); at(e) }
      const mv = (e: PointerEvent) => down && at(e)
      const up = () => { down = false }
      el.addEventListener('pointerdown', dn)
      el.addEventListener('pointermove', mv)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      offs.push(() => {
        el.removeEventListener('pointerdown', dn)
        el.removeEventListener('pointermove', mv)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
      })
    }
    return () => offs.forEach((f) => f())
  }, [d, onSeek])

  return (
    <div className="figs">
      <Figure title="The path down" caption="Height against how far the breeze carried it. Sideways is in centimetres, height in metres.">
        <canvas ref={path} className="fig-canvas" style={{ height: 156 }} />
      </Figure>
      <Figure title="Bend and twist" caption="The leaf bends along its length, across its width, and twists, all at once. Drag to scrub.">
        <canvas ref={flex} className="fig-canvas scrub" style={{ height: 112 }} />
      </Figure>
      <Figure title="Speed and the breeze" caption="On average it falls about 0.7 m/s, but each swing speeds it up, slows it, even lifts it for a moment. Its sideways dashes far outrun the gentle breeze.">
        <canvas ref={speed} className="fig-canvas scrub" style={{ height: 112 }} />
      </Figure>
      <Figure title="Rocking" caption="How far the leaf tips from lying flat. Again and again it swings up to edge-on and back: its flutter.">
        <canvas ref={rock} className="fig-canvas scrub" style={{ height: 96 }} />
      </Figure>
    </div>
  )
}

// ---------------------------------------------------------------- data

type Derived = ReturnType<typeof derive>

function derive(b: LeafBundle) {
  const n = b.frames
  const dt = 1 / b.rate
  const P = b.flight.position
  const Q = b.flight.quaternion
  const E = b.flight.eta
  const W = b.flight.wind
  const side = new Float32Array(n)
  const height = new Float32Array(n)
  const flex = [new Float32Array(n), new Float32Array(n), new Float32Array(n)]
  const fall = new Float32Array(n)
  const sway = new Float32Array(n)
  const wind = new Float32Array(n)
  const tilt = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    side[k] = (P[3 * k]! - P[0]!) * 100
    height[k] = P[3 * k + 2]!
    for (let j = 0; j < 3; j++) flex[j]![k] = E[3 * k + j]! * 1000
    const a = Math.max(0, k - 1), c = Math.min(n - 1, k + 1)
    const h = (c - a) * dt
    fall[k] = -(P[3 * c + 2]! - P[3 * a + 2]!) / h
    sway[k] = (P[3 * c]! - P[3 * a]!) / h
    wind[k] = W[3 * k]!
    const x = Q[4 * k + 1]!, y = Q[4 * k + 2]!
    const nz = 1 - 2 * (x * x + y * y) // body normal's vertical component
    tilt[k] = (Math.acos(Math.min(1, Math.abs(nz))) * 180) / Math.PI
  }
  const max = (a: Float32Array) => a.reduce((m, v) => Math.max(m, v), -Infinity)
  const min = (a: Float32Array) => a.reduce((m, v) => Math.min(m, v), Infinity)
  const flexMax = Math.ceil(Math.max(...flex.map((f) => Math.max(max(f), -min(f))))) + 1
  return {
    n,
    rate: b.rate,
    duration: b.duration,
    side,
    height,
    sideMin: Math.min(0, min(side)),
    sideMax: max(side),
    flexMax,
    flex: [
      { v: flex[0]!, color: gold, label: 'along' },
      { v: flex[1]!, color: (a: number) => ink(a * 0.85), label: 'across' },
      { v: flex[2]!, color: (a: number) => `rgba(150,170,190,${a})`, label: 'twist' }
    ] as Series[],
    speed: [
      { v: fall, color: gold, label: 'falling' },
      { v: sway, color: (a: number) => ink(a * 0.85), label: 'sideways' },
      { v: wind, color: (a: number) => `rgba(150,170,190,${a})`, dash: [3, 3], label: 'breeze' }
    ] as Series[],
    speedMin: Math.min(min(sway), min(wind)),
    speedMax: Math.ceil(Math.max(max(fall), max(sway)) * 5) / 5,
    rock: [{ v: tilt, color: gold, label: 'tilt' }] as Series[]
  }
}

// ---------------------------------------------------------------- drawing

const PAD = { L: 30, R: 6, T: 20, B: 16 }

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
  return { g, w, h }
}

function niceStep(range: number) {
  const raw = range / 3
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

function drawPath(c: HTMLCanvasElement, d: Derived, t: number) {
  const { g, w, h } = prep(c)
  const L = 30, R = 8, T = 10, B = 18
  const pw = w - L - R, ph = h - T - B
  const top = Math.ceil(d.height[0]! * 2) / 2
  const sx0 = Math.floor(d.sideMin / 10) * 10, sx1 = Math.ceil(d.sideMax / 10) * 10
  const x = (s: number) => L + ((s - sx0) / (sx1 - sx0)) * pw
  const y = (z: number) => T + ph - (z / top) * ph

  g.strokeStyle = ink(0.07)
  g.fillStyle = ink(0.35)
  g.textAlign = 'right'
  for (let z = 0; z <= top + 1e-6; z += 1) {
    g.beginPath(); g.moveTo(L, y(z) + 0.5); g.lineTo(w - R, y(z) + 0.5); g.stroke()
    g.fillText(`${z} m`, L - 5, y(z) + 3)
  }
  g.textAlign = 'center'
  const step = niceStep(sx1 - sx0)
  for (let s = sx0; s <= sx1 + 1e-6; s += step) g.fillText(`${Math.round(s)}`, x(s), h - 4)
  g.textAlign = 'right'
  g.fillText('cm', w - R, h - 4)

  const k = Math.min(d.n - 1, Math.floor(t * d.rate))
  g.lineWidth = 1.2
  g.strokeStyle = ink(0.18)
  line(g, d.n, (i) => x(d.side[i]!), (i) => y(d.height[i]!), 0, d.n)
  g.strokeStyle = gold(0.95)
  g.lineWidth = 1.6
  line(g, d.n, (i) => x(d.side[i]!), (i) => y(d.height[i]!), 0, k + 1)
  g.fillStyle = gold(1)
  g.beginPath(); g.arc(x(d.side[k]!), y(d.height[k]!), 3.4, 0, Math.PI * 2); g.fill()

  g.textAlign = 'left'
  g.fillStyle = gold(1)
  g.font = `10px ${MONO}`
  g.fillText(`${t.toFixed(2)} s · ${d.height[k]!.toFixed(2)} m`, L + 6, T + 10)
}

function drawSeries(c: HTMLCanvasElement, d: Derived, t: number, series: Series[], unit: string, [y0, y1]: number[]) {
  const { g, w, h } = prep(c)
  const { L, R, T, B } = PAD
  const pw = w - L - R, ph = h - T - B
  const x = (k: number) => L + (k / (d.n - 1)) * pw
  const y = (v: number) => T + ph - ((v - y0!) / (y1! - y0!)) * ph

  const step = niceStep(y1! - y0!)
  g.textAlign = 'right'
  for (let v = Math.ceil(y0! / step) * step; v <= y1! + 1e-9; v += step) {
    g.strokeStyle = v === 0 ? ink(0.2) : ink(0.07)
    g.beginPath(); g.moveTo(L, y(v) + 0.5); g.lineTo(w - R, y(v) + 0.5); g.stroke()
    g.fillStyle = ink(0.35)
    g.fillText(`${+v.toFixed(2)}`, L - 5, y(v) + 3)
  }
  g.textAlign = 'center'
  for (let s = 0; s <= d.duration; s += 1) g.fillText(`${s}`, L + (s / d.duration) * pw, h - 4)
  g.textAlign = 'right'
  g.fillText('s', w - R, h - 4)

  const k = Math.min(d.n - 1, Math.floor(t * d.rate))
  for (const s of series) {
    g.setLineDash(s.dash ?? [])
    g.lineWidth = 1
    g.strokeStyle = s.color(0.22)
    line(g, d.n, x, (i) => y(s.v[i]!), 0, d.n)
    g.lineWidth = 1.5
    g.strokeStyle = s.color(0.95)
    line(g, d.n, x, (i) => y(s.v[i]!), 0, k + 1)
  }
  g.setLineDash([])

  // Playhead
  g.strokeStyle = gold(0.5)
  g.beginPath(); g.moveTo(x(k) + 0.5, T); g.lineTo(x(k) + 0.5, T + ph); g.stroke()

  // Legend with current values
  g.textAlign = 'left'
  g.font = `9px ${MONO}`
  let lx = L
  for (const s of series) {
    const txt = `${s.label} ${s.v[k]!.toFixed(unit === '°' ? 0 : 2)}${unit === '°' ? '°' : ''}`
    g.fillStyle = s.color(1)
    g.fillText(txt, lx, 10)
    lx += g.measureText(txt).width + 12
  }
  g.textAlign = 'right'
  g.fillStyle = ink(0.35)
  g.fillText(unit, w - R, 10)
}

function line(g: CanvasRenderingContext2D, n: number, x: (i: number) => number, y: (i: number) => number, from: number, to: number) {
  g.beginPath()
  for (let i = from; i < Math.min(n, to); i++) {
    if (i === from) g.moveTo(x(i), y(i))
    else g.lineTo(x(i), y(i))
  }
  g.stroke()
}
