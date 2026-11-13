import { useEffect, useMemo, useRef } from 'react'
import { Figure } from '../../components/BehindPanel'
import type { CloseGlass } from './closeData'

const INK = '244,239,230'
const GOLD = '217,185,138'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const ink = (a: number) => `rgba(${INK},${a})`
const gold = (a: number) => `rgba(${GOLD},${a})`
const FAMILY = ['rgba(217,185,138,1)', 'rgba(150,190,230,1)', 'rgba(140,210,170,1)', 'rgba(230,140,120,1)', 'rgba(190,160,230,1)']

function hz(f: number) {
  return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`
}

/**
 * Plots behind the close-up: the strike (force), how each ring shape builds during the
 * contact, and how the strike's energy is shared between ring shapes.
 */
export default function ClosePlots({ glass, getTime, family, open }: { glass: CloseGlass | null; getTime: () => number; family: number | null; open: boolean }) {
  const strike = useRef<HTMLCanvasElement>(null)
  const build = useRef<HTMLCanvasElement>(null)
  const energy = useRef<HTMLCanvasElement>(null)

  // Per-family amplitude during the contact window: sqrt(sum q^2) over the family's two modes.
  const fam = useMemo(() => {
    if (!glass) return null
    const nm = glass.modes.length
    const steps = glass.contact.t_us.length
    const orders = [...new Set(glass.modes.map((m) => m.n))]
    const series = orders.map((n) =>
      Array.from({ length: steps }, (_, s) =>
        Math.sqrt(glass.modes.reduce((a, m, j) => (m.n === n ? a + glass.contact.q[s * nm + j]! ** 2 : a), 0))
      )
    )
    const max = Math.max(...series.flat())
    return { orders, series, max }
  }, [glass])

  useEffect(() => {
    if (!open || !glass || !fam) return
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const t = getTime()
      if (strike.current) drawStrike(strike.current, glass, t)
      if (build.current) drawBuild(build.current, glass, fam, t, family)
      if (energy.current) drawEnergy(energy.current, glass, family)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [open, glass, fam, getTime, family])

  return (
    <div className="figs">
      <Figure title="The strike" caption={glass ? `Mallet contact force. The touch lasts ${Math.round(glass.contact.end_us)} millionths of a second; the glass rings long after.` : ''}>
        <canvas ref={strike} className="fig-canvas" style={{ height: 112 }} />
      </Figure>
      <Figure title="How the ringing builds" caption="During that brief touch, each ring shape is set going. Size of each shape’s motion through the strike.">
        <canvas ref={build} className="fig-canvas" style={{ height: 124 }} />
      </Figure>
      <Figure title="Energy in each ring shape" caption="How the strike’s energy is shared after release, with each shape’s pitch. The lowest, two-lobe shape sets the note you hear.">
        <canvas ref={energy} className="fig-canvas" style={{ height: 120 }} />
      </Figure>
    </div>
  )
}

function prep(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = c.clientWidth, h = c.clientHeight
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

function timeAxis(g: CanvasRenderingContext2D, w: number, h: number, L: number, R: number, tmax: number) {
  const pw = w - L - R
  g.fillStyle = ink(0.35)
  g.textAlign = 'center'
  for (let t = 0; t <= tmax; t += 20) g.fillText(`${t}`, L + (t / tmax) * pw, h - 4)
  g.textAlign = 'right'
  g.fillText('µs', w - R, h - 4)
}

function playhead(g: CanvasRenderingContext2D, x: number, T: number, ph: number) {
  g.strokeStyle = gold(0.55)
  g.beginPath(); g.moveTo(x + 0.5, T); g.lineTo(x + 0.5, T + ph); g.stroke()
}

function drawStrike(c: HTMLCanvasElement, glass: CloseGlass, tUs: number) {
  const { g, w, h } = prep(c)
  const L = 26, R = 6, T = 18, B = 16
  const pw = w - L - R, ph = h - T - B
  const t = glass.contact.t_us, f = glass.contact.force
  const tmax = t[t.length - 1]!
  const fmax = glass.contact.peak_force * 1.12
  const X = (v: number) => L + (v / tmax) * pw
  const Y = (v: number) => T + ph - (v / fmax) * ph
  g.strokeStyle = ink(0.2)
  g.beginPath(); g.moveTo(L, T + ph + 0.5); g.lineTo(w - R, T + ph + 0.5); g.stroke()
  timeAxis(g, w, h, L, R, tmax)
  g.strokeStyle = ink(0.18); g.lineWidth = 1
  g.beginPath(); t.forEach((v, i) => (i ? g.lineTo(X(v), Y(f[i]!)) : g.moveTo(X(v), Y(f[i]!)))); g.stroke()
  g.strokeStyle = gold(1); g.lineWidth = 1.6
  g.beginPath()
  t.forEach((v, i) => { if (v > tUs) return; if (i) g.lineTo(X(v), Y(f[i]!)); else g.moveTo(X(v), Y(f[i]!)) })
  g.stroke()
  if (tUs <= tmax) playhead(g, X(Math.min(tUs, tmax)), T, ph)
  g.textAlign = 'left'
  g.fillStyle = gold(1)
  g.font = `10px ${MONO}`
  g.fillText(`peak ${glass.contact.peak_force.toFixed(2)} N`, L, 11)
}

function drawBuild(c: HTMLCanvasElement, glass: CloseGlass, fam: { orders: number[]; series: number[][]; max: number }, tUs: number, sel: number | null) {
  const { g, w, h } = prep(c)
  const L = 26, R = 6, T = 20, B = 16
  const pw = w - L - R, ph = h - T - B
  const t = glass.contact.t_us
  const tmax = t[t.length - 1]!
  const X = (v: number) => L + (v / tmax) * pw
  const Y = (v: number) => T + ph - (v / fam.max) * ph
  g.strokeStyle = ink(0.2)
  g.beginPath(); g.moveTo(L, T + ph + 0.5); g.lineTo(w - R, T + ph + 0.5); g.stroke()
  timeAxis(g, w, h, L, R, tmax)
  fam.orders.forEach((n, k) => {
    const on = sel === null || sel === n
    g.strokeStyle = FAMILY[k % FAMILY.length]!.replace(',1)', `,${on ? 0.95 : 0.15})`)
    g.lineWidth = on ? 1.5 : 1
    g.beginPath()
    t.forEach((v, i) => { if (v > tUs) return; const y = Y(fam.series[k]![i]!); if (i) g.lineTo(X(v), y); else g.moveTo(X(v), y) })
    g.stroke()
  })
  if (tUs <= tmax) playhead(g, X(Math.min(tUs, tmax)), T, ph)
  g.textAlign = 'left'
  let lx = L
  fam.orders.forEach((n, k) => {
    const txt = `${n} lobes`
    g.fillStyle = FAMILY[k % FAMILY.length]!.replace(',1)', `,${sel === null || sel === n ? 1 : 0.3})`)
    g.fillText(txt, lx, 10)
    lx += g.measureText(txt).width + 9
  })
}

function drawEnergy(c: HTMLCanvasElement, glass: CloseGlass, sel: number | null) {
  const { g, w, h } = prep(c)
  const { order, energy, frequency } = glass.family
  const L = 8, R = 8, T = 16, B = 30
  const pw = w - L - R, ph = h - T - B
  const total = energy.reduce((a, v) => a + v, 0)
  const max = Math.max(...energy)
  const bw = (pw / order.length) * 0.56
  order.forEach((n, k) => {
    const on = sel === null || sel === n
    const x = L + (k + 0.5) * (pw / order.length) - bw / 2
    const hgt = (energy[k]! / max) * ph
    g.fillStyle = FAMILY[k % FAMILY.length]!.replace(',1)', `,${on ? 0.9 : 0.2})`)
    g.fillRect(x, T + ph - hgt, bw, hgt)
    g.textAlign = 'center'
    g.fillStyle = ink(on ? 0.75 : 0.3)
    g.fillText(`${Math.round((energy[k]! / total) * 100)}%`, x + bw / 2, T + ph - hgt - 4)
    g.fillStyle = ink(on ? 0.55 : 0.25)
    g.fillText(`${n} lobes`, x + bw / 2, h - 16)
    g.fillStyle = ink(0.35)
    g.fillText(`${hz(frequency[k]!)} Hz`, x + bw / 2, h - 4)
  })
}
