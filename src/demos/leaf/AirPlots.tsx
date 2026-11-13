import { useEffect, useRef } from 'react'
import { Figure } from '../../components/BehindPanel'
import { deltaColor, pressureColor, type Air } from './airData'

const GOLD = '217,185,138'
const INK = '244,239,230'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const ink = (a: number) => `rgba(${INK},${a})`
const gold = (a: number) => `rgba(${GOLD},${a})`

/** Plots behind the close-up: slice maps, how the leaf gives way, and the air's push. */
export default function AirPlots({ air }: { air: Air | null }) {
  const speed = useRef<HTMLCanvasElement>(null)
  const pressure = useRef<HTMLCanvasElement>(null)
  const give = useRef<HTMLCanvasElement>(null)
  const push = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!air) return
    const draw = () => {
      if (speed.current) drawSlice(speed.current, air, 'speed')
      if (pressure.current) drawSlice(pressure.current, air, 'pressure')
      if (give.current) drawGive(give.current, air)
      if (push.current) drawPush(push.current, air)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ;[speed, pressure, give, push].forEach((r) => r.current && ro.observe(r.current))
    return () => ro.disconnect()
  }, [air])

  const ms = air ? (air.meta.field.time * 1000).toFixed(0) : '6'
  return (
    <div className="figs">
      <Figure title="Air speed through the leaf" caption={`A cut through the middle of the leaf at ${ms} ms; the breeze comes from the left. Air at the breeze’s 0.3 m/s is dark, slower air teal, faster air gold.`}>
        <canvas ref={speed} className="fig-canvas" style={{ height: 150 }} />
      </Figure>
      <Figure title="Air pressure" caption="The same cut. Amber pushes, blue pulls: push beneath the tilted leaf, suction above it. Fractions of a pascal, yet over the whole leaf they add up to the push below.">
        <canvas ref={pressure} className="fig-canvas" style={{ height: 150 }} />
      </Figure>
      <Figure title="How the leaf gives way" caption="Largest movement of any point on the leaf, in micrometres: all of it, and just its bending once the overall shift and turn are taken out.">
        <canvas ref={give} className="fig-canvas" style={{ height: 112 }} />
      </Figure>
      <Figure title="The air’s push" caption="Total force of the air on the leaf, along the breeze and upward. The sudden start gives a sharp kick; then the push settles to a far smaller one.">
        <canvas ref={push} className="fig-canvas" style={{ height: 112 }} />
      </Figure>
    </div>
  )
}

function prep(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = c.clientWidth
  const h = c.clientHeight
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  g.font = `9px ${MONO}`
  return { g, w, h }
}

function drawSlice(c: HTMLCanvasElement, air: Air, kind: 'speed' | 'pressure') {
  const { g, w, h } = prep(c)
  const s = air.meta.slice
  const [sx, sz] = s.n
  const { lo, hi } = air.meta.box
  const B = 18
  // Fit the box's x-z aspect into the canvas.
  const ar = (hi[0]! - lo[0]!) / (hi[2]! - lo[2]!)
  let pw = w, ph = pw / ar
  if (ph > h - B) { ph = h - B; pw = ph * ar }
  const ox = (w - pw) / 2, oy = 0

  const img = new ImageData(sx, sz)
  const col = [0, 0, 0]
  const pmax = Math.max(Math.abs(s.pressure_range[0]), Math.abs(s.pressure_range[1]))
  for (let j = 0; j < sz; j++) {
    for (let i = 0; i < sx; i++) {
      const src = j * sx + i
      const dst = ((sz - 1 - j) * sx + i) * 4 // flip: top row = high z
      if (kind === 'speed') deltaColor(air.speed[src]! * s.speed_scale, air.meta.wind, s.speed_max, col)
      else {
        const v = (air.pressure[src]! * s.pressure_scale) / pmax
        pressureColor(Math.sign(v) * Math.pow(Math.abs(v), 0.6), col)
      }
      img.data[dst] = 255 * col[0]!
      img.data[dst + 1] = 255 * col[1]!
      img.data[dst + 2] = 255 * col[2]!
      img.data[dst + 3] = 255
    }
  }
  const off = document.createElement('canvas')
  off.width = sx
  off.height = sz
  off.getContext('2d')!.putImageData(img, 0, 0)
  g.imageSmoothingEnabled = true
  g.drawImage(off, ox, oy, pw, ph)
  g.strokeStyle = ink(0.15)
  g.strokeRect(ox + 0.5, oy + 0.5, pw - 1, ph - 1)

  // Leaf cross-section
  const X = (x: number) => ox + ((x - lo[0]!) / (hi[0]! - lo[0]!)) * pw
  const Z = (z: number) => oy + ph - ((z - lo[2]!) / (hi[2]! - lo[2]!)) * ph
  const cut = air.meta.leaf.cut
  g.strokeStyle = 'rgba(255,240,220,0.95)'
  g.lineWidth = 2
  g.beginPath()
  for (let k = 0; k < cut.length; k += 4) {
    g.moveTo(X(cut[k]!), Z(cut[k + 1]!))
    g.lineTo(X(cut[k + 2]!), Z(cut[k + 3]!))
  }
  g.stroke()

  // Breeze arrow
  g.strokeStyle = ink(0.6)
  g.fillStyle = ink(0.6)
  g.lineWidth = 1
  const ay = oy + 12
  g.beginPath(); g.moveTo(ox + 8, ay); g.lineTo(ox + 34, ay); g.stroke()
  g.beginPath(); g.moveTo(ox + 34, ay); g.lineTo(ox + 29, ay - 3); g.lineTo(ox + 29, ay + 3); g.fill()

  // Legend
  g.textAlign = 'left'
  g.fillStyle = ink(0.45)
  const ly = h - 4
  if (kind === 'speed') {
    const wind = air.meta.wind
    for (let i = 0; i < 60; i++) {
      deltaColor((i / 59) * s.speed_max, wind, s.speed_max, col)
      g.fillStyle = `rgb(${255 * col[0]!},${255 * col[1]!},${255 * col[2]!})`
      g.fillRect(ox + 34 + i, ly - 7, 1, 6)
    }
    g.fillStyle = ink(0.45)
    g.fillText('0', ox + 24, ly)
    g.fillText(`${s.speed_max.toFixed(2)} m/s`, ox + 100, ly)
    // Tick at the breeze speed: undisturbed air is dark.
    const bx = ox + 34 + (wind / s.speed_max) * 59
    g.fillRect(bx, ly - 10, 1, 3)
  } else {
    for (let i = 0; i < 60; i++) {
      pressureColor((i / 59) * 2 - 1, col)
      g.fillStyle = `rgb(${255 * col[0]!},${255 * col[1]!},${255 * col[2]!})`
      g.fillRect(ox + 52 + i, ly - 7, 1, 6)
    }
    g.fillStyle = ink(0.45)
    g.fillText(`${(-pmax).toFixed(2)}`, ox, ly)
    g.fillText(`+${pmax.toFixed(2)} Pa`, ox + 118, ly)
  }
}

function axes(g: CanvasRenderingContext2D, w: number, h: number, L: number, R: number, T: number, B: number, ymax: number, unit: string, tmax: number) {
  const pw = w - L - R, ph = h - T - B
  const step = niceStep(ymax)
  g.textAlign = 'right'
  for (let v = 0; v <= ymax + 1e-12; v += step) {
    const y = T + ph - (v / ymax) * ph
    g.strokeStyle = v === 0 ? ink(0.2) : ink(0.07)
    g.beginPath(); g.moveTo(L, y + 0.5); g.lineTo(w - R, y + 0.5); g.stroke()
    g.fillStyle = ink(0.35)
    g.fillText(fmt(v), L - 5, y + 3)
  }
  g.textAlign = 'center'
  for (let t = 0; t <= tmax + 1e-9; t += 1) g.fillText(`${t}`, L + (t / tmax) * pw, h - 4)
  g.textAlign = 'right'
  g.fillText('ms', w - R, h - 4)
  g.fillText(unit, w - R, 10)
  return { pw, ph }
}

function drawGive(c: HTMLCanvasElement, air: Air) {
  const { g, w, h } = prep(c)
  const L = 34, R = 6, T = 20, B = 16
  const t = air.meta.time.map((s) => s * 1000)
  const tot = air.meta.history.total.map((v) => v * 1e6)
  const ela = air.meta.history.elastic.map((v) => v * 1e6)
  const ymax = niceCeil(Math.max(...tot))
  const tmax = t[t.length - 1]!
  const { pw, ph } = axes(g, w, h, L, R, T, B, ymax, 'µm', tmax)
  const X = (v: number) => L + (v / tmax) * pw
  const Y = (v: number) => T + ph - (v / ymax) * ph
  series(g, t, tot, X, Y, gold(1))
  series(g, t, ela, X, Y, ink(0.75))
  legend(g, L, [[`all ${fmt(tot[tot.length - 1]!)} µm`, gold(1)], [`bending ${fmt(ela[ela.length - 1]!)} µm`, ink(0.75)]])
}

function drawPush(c: HTMLCanvasElement, air: Air) {
  const { g, w, h } = prep(c)
  const L = 34, R = 6, T = 20, B = 16
  const t = air.meta.time.slice(1).map((s) => s * 1000)
  const F = air.meta.history.force
  const mag = Math.max(...F.flat().map(Math.abs))
  const [k, unit] = mag < 1e-3 ? [1e6, 'µN'] : [1e3, 'mN']
  const drag = F.map((f) => f[0]! * k)
  const lift = F.map((f) => f[2]! * k)
  const lo = Math.min(0, ...drag, ...lift)
  const hi = Math.max(0, ...drag, ...lift)
  const pad = (hi - lo) * 0.1 || 1
  const y0 = lo - (lo < 0 ? pad : 0), y1 = hi + pad
  const tmax = air.meta.time[air.meta.time.length - 1]! * 1000
  const pw = w - L - R, ph = h - T - B
  const X = (v: number) => L + (v / tmax) * pw
  const Y = (v: number) => T + ph - ((v - y0) / (y1 - y0)) * ph
  const step = niceStep(y1 - y0)
  g.textAlign = 'right'
  for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-12; v += step) {
    g.strokeStyle = Math.abs(v) < 1e-12 ? ink(0.2) : ink(0.07)
    g.beginPath(); g.moveTo(L, Y(v) + 0.5); g.lineTo(w - R, Y(v) + 0.5); g.stroke()
    g.fillStyle = ink(0.35)
    g.fillText(fmt(v), L - 5, Y(v) + 3)
  }
  g.textAlign = 'center'
  for (let s = 0; s <= tmax + 1e-9; s += 1) g.fillText(`${s}`, X(s), h - 4)
  g.textAlign = 'right'
  g.fillText('ms', w - R, h - 4)
  g.fillText(unit, w - R, 10)
  series(g, t, drag, X, Y, gold(1))
  series(g, t, lift, X, Y, 'rgba(150,170,190,1)')
  legend(g, L, [[`along ${fmt(drag[drag.length - 1]!)}`, gold(1)], [`up ${fmt(lift[lift.length - 1]!)}`, 'rgba(150,170,190,1)']])
}

function series(g: CanvasRenderingContext2D, t: number[], v: number[], X: (n: number) => number, Y: (n: number) => number, color: string) {
  g.strokeStyle = color
  g.fillStyle = color
  g.lineWidth = 1.5
  g.beginPath()
  t.forEach((s, i) => (i ? g.lineTo(X(s), Y(v[i]!)) : g.moveTo(X(s), Y(v[i]!))))
  g.stroke()
  t.forEach((s, i) => { g.beginPath(); g.arc(X(s), Y(v[i]!), 2.4, 0, Math.PI * 2); g.fill() })
}

function legend(g: CanvasRenderingContext2D, x: number, items: [string, string][]) {
  g.textAlign = 'left'
  for (const [txt, color] of items) {
    g.fillStyle = color
    g.fillText(txt, x, 10)
    x += g.measureText(txt).width + 12
  }
}

function niceStep(range: number) {
  const raw = range / 3
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

function niceCeil(v: number) {
  const s = niceStep(v)
  return Math.ceil(v / s) * s
}

function fmt(v: number) {
  const a = Math.abs(v)
  return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(2)
}
