import { useEffect, useRef } from 'react'
import { Figure } from '../../components/BehindPanel'
import { css, orderAngle, type Room } from './data'

const INK = '244,239,230'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const ink = (a: number) => `rgba(${INK},${a})`

function prep(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = c.clientWidth, h = c.clientHeight
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  g.font = `9px ${MONO}`
  return { g, w, h }
}

/** Mean of TE and TM for order m (transmitted or reflected). */
function eff(room: Room, b: number, m: number, kind: 'T' | 'R') {
  const [te, tm] = room.efficiency[b]!
  const i = te.orders.indexOf(m)
  return i < 0 ? 0 : (te[kind][i]! + tm[kind][i]!) / 2
}

function useDraw(draw: () => void, deps: unknown[], refs: React.RefObject<HTMLCanvasElement>[]) {
  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    refs.forEach((r) => r.current && ro.observe(r.current))
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// ---------------------------------------------------------------- room view

export type Budget = { rows: { label: string; watts: number }[]; input: number; tilt: number }

export function RoomPlots({ room, band, budget: live }: { room: Room | null; band: number | null; budget: Budget | null }) {
  const angles = useRef<HTMLCanvasElement>(null)
  const split = useRef<HTMLCanvasElement>(null)
  const budget = useRef<HTMLCanvasElement>(null)
  useDraw(() => {
    if (!room) return
    if (angles.current) drawAngles(angles.current, room, band)
    if (split.current) drawSplit(split.current, room, band)
    if (budget.current && live) drawBudget(budget.current, live)
  }, [room, band, live], [angles, split, budget])
  return (
    <div className="figs">
      <Figure title="Where each colour goes" caption="Each colour leaves the grating straight on and at a few fixed angles. Longer, redder waves bend further. Dot size shows how much light takes each path.">
        <canvas ref={angles} className="fig-canvas" style={{ height: 150 }} />
      </Figure>
      <Figure title="How each colour splits" caption="Share of each colour that goes straight through, bends once, bends twice, or reflects back. Both polarisations averaged.">
        <canvas ref={split} className="fig-canvas" style={{ height: 128 }} />
      </Figure>
      <Figure title="Where the power lands" caption={`${live ? live.input.toFixed(0) : 12} watts of sunlight through the window, at a sun height of ${live ? Math.round(live.tilt) : 40}°. The straight-through light makes the bright white bar; the bent colours spread to either side. Updates as you move the sun.`}>
        <canvas ref={budget} className="fig-canvas" style={{ height: 190 }} />
      </Figure>
    </div>
  )
}

// ---------------------------------------------------------------- grating view

export function GratingPlots({ room, band }: { room: Room | null; band: number | null }) {
  const bars = useRef<HTMLCanvasElement>(null)
  const spectrum = useRef<HTMLCanvasElement>(null)
  const angles = useRef<HTMLCanvasElement>(null)
  useDraw(() => {
    if (!room) return
    if (bars.current) drawOrders(bars.current, room, band ?? 3)
    if (spectrum.current) drawSpectrum(spectrum.current, room, band)
    if (angles.current) drawAngles(angles.current, room, band)
  }, [room, band], [bars, spectrum, angles])
  const nm = room ? room.bands[band ?? 3]!.nm : 555
  return (
    <div className="figs">
      <Figure title={`One colour, ${nm} nm`} caption={`How ${nm} nm light divides at the ridges: up into the air (transmitted) or back into the glass (reflected), order by order. ${band === null ? 'Pick a colour to change it.' : ''}`}>
        <canvas ref={bars} className="fig-canvas" style={{ height: 140 }} />
      </Figure>
      <Figure title="Across the spectrum" caption="Straight-through and first-bend shares for every colour. Solid: E along the grooves (shown on the left); dashed: E across them.">
        <canvas ref={spectrum} className="fig-canvas" style={{ height: 124 }} />
      </Figure>
      <Figure title="Angles out of the grating" caption="The dashed lines over the wave: each order leaves at a fixed angle set by the colour and the 1 µm spacing.">
        <canvas ref={angles} className="fig-canvas" style={{ height: 150 }} />
      </Figure>
    </div>
  )
}

// ---------------------------------------------------------------- drawing

function drawAngles(c: HTMLCanvasElement, room: Room, sel: number | null) {
  const { g, w, h } = prep(c)
  const L = 30, R = 8, T = 10, B = 18
  const pw = w - L - R, ph = h - T - B
  const X = (nm: number) => L + ((nm - 400) / 310) * pw
  const Y = (deg: number) => T + ph / 2 - (deg / 90) * (ph / 2)
  g.textAlign = 'right'
  for (const a of [-90, -45, 0, 45, 90]) {
    g.strokeStyle = a === 0 ? ink(0.2) : ink(0.07)
    g.beginPath(); g.moveTo(L, Y(a) + 0.5); g.lineTo(w - R, Y(a) + 0.5); g.stroke()
    g.fillStyle = ink(0.35)
    g.fillText(`${a}°`, L - 4, Y(a) + 3)
  }
  g.textAlign = 'center'
  for (const nm of [400, 500, 600, 700]) g.fillText(`${nm}`, X(nm), h - 5)
  g.textAlign = 'right'
  g.fillText('nm', w - R, h - 5)
  // Grating equation curves.
  g.strokeStyle = ink(0.16)
  for (const m of [-2, -1, 1, 2]) {
    g.beginPath()
    let started = false
    for (let nm = 400; nm <= 710; nm += 2) {
      const a = orderAngle(m, nm, room.period)
      if (a === null) { started = false; continue }
      if (started) g.lineTo(X(nm), Y(a)); else { g.moveTo(X(nm), Y(a)); started = true }
    }
    g.stroke()
  }
  room.bands.forEach((b, i) => {
    for (const m of [-2, -1, 0, 1, 2]) {
      const a = orderAngle(m, b.nm, room.period)
      if (a === null) continue
      const e = eff(room, i, m, 'T')
      const on = sel === null || sel === i
      g.fillStyle = css(b.rgb, on ? 1 : 0.22)
      g.beginPath(); g.arc(X(b.nm), Y(a), 1.5 + Math.sqrt(e) * 7, 0, Math.PI * 2); g.fill()
    }
  })
}

function drawSplit(c: HTMLCanvasElement, room: Room, sel: number | null) {
  const { g, w, h } = prep(c)
  const L = 30, R = 6, T = 18, B = 16
  const pw = w - L - R, ph = h - T - B
  const n = room.bands.length
  const bw = (pw / n) * 0.62
  g.textAlign = 'right'
  for (const v of [0, 0.5, 1]) {
    const y = T + ph - v * ph
    g.strokeStyle = ink(0.07)
    g.beginPath(); g.moveTo(L, y + 0.5); g.lineTo(w - R, y + 0.5); g.stroke()
    g.fillStyle = ink(0.35)
    g.fillText(`${v * 100}%`, L - 4, y + 3)
  }
  room.bands.forEach((b, i) => {
    const parts = [
      eff(room, i, 0, 'T'),
      eff(room, i, -1, 'T') + eff(room, i, 1, 'T'),
      eff(room, i, -2, 'T') + eff(room, i, 2, 'T'),
      room.efficiency[i]!.reduce((s, p) => s + p.R.reduce((a, v) => a + v, 0), 0) / 2
    ]
    const alpha = [1, 0.62, 0.34, 0]
    const on = sel === null || sel === i
    let y = T + ph
    const x = L + (i + 0.5) * (pw / n) - bw / 2
    parts.forEach((p, k) => {
      const hgt = p * ph
      g.fillStyle = k === 3 ? ink(on ? 0.22 : 0.08) : css(b.rgb, alpha[k]! * (on ? 1 : 0.3))
      g.fillRect(x, y - hgt, bw, hgt)
      y -= hgt
    })
    g.fillStyle = on ? ink(0.6) : ink(0.3)
    g.textAlign = 'center'
    g.fillText(`${b.nm}`, x + bw / 2, h - 3)
  })
  g.textAlign = 'left'
  const items: [string, string][] = [['straight', ink(0.85)], ['1st bend', ink(0.55)], ['2nd', ink(0.32)], ['reflected', ink(0.2)]]
  let lx = L
  for (const [t, col] of items) {
    g.fillStyle = col
    g.fillRect(lx, 4, 7, 7)
    g.fillText(t, lx + 10, 11)
    lx += g.measureText(t).width + 22
  }
}

function drawBudget(c: HTMLCanvasElement, b: Budget) {
  const { g, w, h } = prep(c)
  const rows = b.rows
  const L = 128, R = 44
  const rowH = Math.min(22, (h - 6) / rows.length)
  g.textBaseline = 'middle'
  rows.forEach(({ label, watts }, i) => {
    const y = 3 + i * rowH + rowH / 2
    g.textAlign = 'right'
    g.fillStyle = ink(0.55)
    g.fillText(label, L - 8, y)
    const bw = (watts / b.input) * (w - L - R)
    const back = label.startsWith('back')
    g.fillStyle = back ? ink(0.25) : 'rgba(217,185,138,0.85)'
    g.fillRect(L, y - 5, Math.max(1, bw), 10)
    g.textAlign = 'left'
    g.fillStyle = ink(0.7)
    g.fillText(`${watts.toFixed(2)} W`, L + bw + 6, y)
  })
  g.textBaseline = 'alphabetic'
}

function drawOrders(c: HTMLCanvasElement, room: Room, band: number) {
  const { g, w, h } = prep(c)
  const [te] = room.efficiency[band]!
  const rgb = room.bands[band]!.rgb
  const L = 30, R = 6, T = 14, B = 16
  const pw = w - L - R, ph = h - T - B
  const mid = T + ph * 0.72
  // One scale for both directions: 60% of light fills the space above the line.
  const k = (ph * 0.68) / 0.6
  const orders = [-2, -1, 0, 1, 2]
  const bw = (pw / orders.length) * 0.5
  g.strokeStyle = ink(0.25)
  g.beginPath(); g.moveTo(L, mid + 0.5); g.lineTo(w - R, mid + 0.5); g.stroke()
  g.fillStyle = ink(0.35)
  g.textAlign = 'right'
  g.fillText('air', L - 4, T + 8)
  g.fillText('glass', L - 4, h - B - 2)
  orders.forEach((m, k) => {
    const i = te.orders.indexOf(m)
    const tv = i < 0 ? 0 : te.T[i]!, rv = i < 0 ? 0 : te.R[i]!
    const x = L + (k + 0.5) * (pw / orders.length) - bw / 2
    g.fillStyle = css(rgb, 0.95)
    g.fillRect(x, mid - tv * k, bw, tv * k)
    g.fillStyle = ink(0.3)
    g.fillRect(x, mid, bw, rv * k)
    g.textAlign = 'center'
    g.fillStyle = ink(0.7)
    if (tv > 0.005) g.fillText(`${Math.round(tv * 100)}%`, x + bw / 2, mid - tv * k - 4)
    g.fillStyle = ink(0.45)
    if (rv > 0.005) g.fillText(`${(rv * 100).toFixed(1)}%`, x + bw / 2, mid + rv * k + 10)
    g.fillStyle = ink(0.45)
    g.fillText(m > 0 ? `+${m}` : `${m}`, x + bw / 2, h - 3)
  })
}

function drawSpectrum(c: HTMLCanvasElement, room: Room, sel: number | null) {
  const { g, w, h } = prep(c)
  const L = 30, R = 8, T = 18, B = 16
  const pw = w - L - R, ph = h - T - B
  const X = (nm: number) => L + ((nm - 400) / 310) * pw
  const Y = (v: number) => T + ph - v * ph
  g.textAlign = 'right'
  for (const v of [0, 0.5, 1]) {
    g.strokeStyle = ink(0.07)
    g.beginPath(); g.moveTo(L, Y(v) + 0.5); g.lineTo(w - R, Y(v) + 0.5); g.stroke()
    g.fillStyle = ink(0.35)
    g.fillText(`${v * 100}%`, L - 4, Y(v) + 3)
  }
  g.textAlign = 'center'
  for (const nm of [400, 500, 600, 700]) g.fillText(`${nm}`, X(nm), h - 4)
  const series = (pol: 0 | 1, pick: (e: { orders: number[]; T: number[] }) => number, color: string, dash: number[]) => {
    g.setLineDash(dash)
    g.strokeStyle = color
    g.lineWidth = 1.4
    g.beginPath()
    room.bands.forEach((b, i) => {
      const v = pick(room.efficiency[i]![pol])
      if (i) g.lineTo(X(b.nm), Y(v)); else g.moveTo(X(b.nm), Y(v))
    })
    g.stroke()
  }
  const T0 = (e: { orders: number[]; T: number[] }) => e.T[e.orders.indexOf(0)] ?? 0
  const T1 = (e: { orders: number[]; T: number[] }) => (e.T[e.orders.indexOf(1)] ?? 0) + (e.T[e.orders.indexOf(-1)] ?? 0)
  series(0, T0, ink(0.85), [])
  series(1, T0, ink(0.85), [3, 3])
  series(0, T1, 'rgba(217,185,138,1)', [])
  series(1, T1, 'rgba(217,185,138,1)', [3, 3])
  g.setLineDash([])
  room.bands.forEach((b, i) => {
    const on = sel === null || sel === i
    g.fillStyle = css(b.rgb, on ? 1 : 0.25)
    g.beginPath(); g.arc(X(b.nm), T + ph + 6, on && sel !== null ? 4 : 2.5, 0, Math.PI * 2); g.fill()
  })
  g.textAlign = 'left'
  g.fillStyle = ink(0.85); g.fillText('straight through', L, 10)
  g.fillStyle = 'rgba(217,185,138,1)'; g.fillText('first bend (both sides)', L + 104, 10)
}
