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
export default function ClosePlots({ glass, air, getTime, family, open }: { glass: CloseGlass | null; air: Int16Array | null; getTime: () => number; family: number | null; open: boolean }) {
  const strike = useRef<HTMLCanvasElement>(null)
  const build = useRef<HTMLCanvasElement>(null)
  const energy = useRef<HTMLCanvasElement>(null)
  const sound = useRef<HTMLCanvasElement>(null)

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

  // Sound map: RMS pressure on the slice. Each ring family (a pair of modes at one pitch)
  // adds coherently; different families add in power.
  useEffect(() => {
    if (!open || !glass || !air || !sound.current) return
    const draw = () => sound.current && drawSound(sound.current, glass, air, family)
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(sound.current)
    return () => ro.disconnect()
  }, [open, glass, air, family])

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
      <Figure title="Sound around the glass" caption="Seen from above: how strongly the ringing glass pushes on the air around it, just after the strike. A shape with n lobes sends sound out in 2n beams, with quiet directions between them.">
        <canvas ref={sound} className="fig-canvas" style={{ height: 200 }} />
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

function drawSound(c: HTMLCanvasElement, glass: CloseGlass, air: Int16Array, sel: number | null) {
  const { g, w, h } = prep(c)
  const { n, half, scale } = glass.air
  const B = 16
  const size = Math.min(w, h - B)
  const ox = (w - size) / 2
  const fams = [...new Set(glass.modes.map((m) => m.n))]
  const rms = new Float32Array(n * n)
  let max = 0
  for (let p = 0; p < n * n; p++) {
    let power = 0
    for (const f of fams) {
      if (sel !== null && f !== sel) continue
      let re = 0, im = 0
      glass.modes.forEach((m, k) => {
        if (m.n !== f) return
        const Pr = air[2 * (k * n * n + p)]! * scale, Pi = air[2 * (k * n * n + p) + 1]! * scale
        // Q = i A e^{-i phi}
        const Qr = m.amp * Math.sin(m.phase), Qi = m.amp * Math.cos(m.phase)
        re += Pr * Qr - Pi * Qi
        im += Pr * Qi + Pi * Qr
      })
      power += (re * re + im * im) / 2
    }
    rms[p] = Math.sqrt(power)
    max = Math.max(max, rms[p]!)
  }
  const img = new ImageData(n, n)
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const v = Math.pow(rms[row * n + col]! / (max || 1), 0.5)
      const d = ((n - 1 - row) * n + col) * 4 // model +y up on the page
      img.data[d] = 255 * (0.04 + 0.92 * v)
      img.data[d + 1] = 255 * (0.03 + 0.7 * v * v)
      img.data[d + 2] = 255 * (0.05 + 0.4 * v * v * v)
      img.data[d + 3] = 255
    }
  }
  const off = document.createElement('canvas')
  off.width = n
  off.height = n
  off.getContext('2d')!.putImageData(img, 0, 0)
  g.imageSmoothingEnabled = true
  g.drawImage(off, ox, 0, size, size)
  // Glass rim and 10 cm scale.
  const px = size / (2 * half)
  g.strokeStyle = ink(0.8)
  g.lineWidth = 1
  g.beginPath(); g.arc(ox + size / 2, size / 2, glass.radius * px, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = ink(0.6)
  g.beginPath(); g.moveTo(ox + 6, size - 8); g.lineTo(ox + 6 + 0.1 * px, size - 8); g.stroke()
  g.fillStyle = ink(0.6)
  g.textAlign = 'left'
  g.fillText('10 cm', ox + 8, size - 12)
  g.fillStyle = ink(0.45)
  g.textAlign = 'center'
  g.fillText(`brightest: ${(max * 1000).toFixed(0)} mPa rms · slice at ${Math.round(glass.air.z * 1000)} mm`, w / 2, h - 3)
}

