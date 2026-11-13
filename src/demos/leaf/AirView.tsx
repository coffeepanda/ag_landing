import { useCallback, useEffect, useRef, useState } from 'react'
import { BehindPanel, BehindToggle, usePanelInset } from '../../components/BehindPanel'
import { loadAir, type Air } from './airData'
import type { AirScene, SliceMode } from './airScene'
import AirPlots from './AirPlots'
import type { ViewProps } from './LeafDemo'

const SIMULATED =
  'A separate, short experiment with the same leaf. Held at a 20° tilt, it meets a 0.3 m/s breeze that switches on all at once. We solved the air flowing around it and the leaf’s own elastic give together, for the first six thousandths of a second. The streaks follow the air as it is at that moment.'

const ASSUMED = [
  'Only the first six milliseconds: the air is just getting going, not a settled wake.',
  'A separate run from the fall, not a zoom into that flight.',
  'Uniform leaf material with no veins; the breeze starts instantly at the edges of the box.',
  'Streaks trace the air frozen at 6 ms, slowed down. The leaf’s bending can be magnified ×100.'
]

const SLICES: SliceMode[] = ['speed', 'pressure', 'off']
const SLICE_LABEL: Record<SliceMode, string> = { speed: 'Slice: speed', pressure: 'Slice: pressure', off: 'Slice: off' }

export default function AirView({ panel: { open: panel, close: closePanel, toggle: togglePanel }, switcher }: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<AirScene | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [air, setAir] = useState<Air | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slice, setSlice] = useState<SliceMode>('speed')
  const [magnified, setMagnified] = useState(false)
  const [slow, setSlow] = useState(true)

  useEffect(() => {
    let disposed = false
    let scene: AirScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Promise.all([loadAir(), import('./airScene')])
      .then(([a, mod]) => {
        if (disposed || !canvasRef.current) return
        setAir(a)
        scene = new mod.AirScene(canvasRef.current, a, {
          reducedMotion,
          onFrame: ({ bar: [x0, y0, x1, y1] }) => {
            const el = barRef.current
            if (!el) return
            const len = Math.hypot(x1 - x0, y1 - y0)
            const ang = Math.atan2(y1 - y0, x1 - x0)
            el.style.transform = `translate(${x0}px, ${y0}px) rotate(${ang}rad)`
            el.style.width = `${len}px`
          }
        })
        sceneRef.current = scene
      })
      .catch((e: unknown) => {
        console.error('[leaf air]', e)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      disposed = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  const setInset = useCallback((r: number, b: number) => sceneRef.current?.setInset(r, b), [])
  usePanelInset(panelRef, panel, setInset, air)

  useEffect(() => sceneRef.current?.setSlice(slice), [slice, air])
  useEffect(() => sceneRef.current?.setMagnified(magnified), [magnified, air])
  useEffect(() => sceneRef.current?.setSlow(slow), [slow, air])

  // Drag to look around; wheel to move closer.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let last: { x: number; y: number } | null = null
    const dn = (e: PointerEvent) => { last = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId) }
    const mv = (e: PointerEvent) => {
      if (!last) return
      sceneRef.current?.orbitBy(e.clientX - last.x, e.clientY - last.y)
      last = { x: e.clientX, y: e.clientY }
    }
    const up = () => { last = null }
    const wheel = (e: WheelEvent) => { e.preventDefault(); sceneRef.current?.zoomBy(Math.exp(e.deltaY * 0.001)) }
    canvas.addEventListener('pointerdown', dn)
    canvas.addEventListener('pointermove', mv)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', dn)
      canvas.removeEventListener('pointermove', mv)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [])

  if (error)
    return (
      <>
        <div className="demo-loading">This view could not load.</div>
        <div className="demo-controls">{switcher}</div>
      </>
    )

  return (
    <>
      <canvas ref={canvasRef} aria-label="Close-up: air streaming around a tilted leaf. Drag to look around." />
      <div className="air-hud" aria-hidden="true">
        <div ref={barRef} className="scale-bar"><span>2 cm</span></div>
      </div>
      <div className="demo-controls">
        {switcher}
        <button className="btn" onClick={() => setSlice((s) => SLICES[(SLICES.indexOf(s) + 1) % SLICES.length]!)} disabled={!air}>
          {SLICE_LABEL[slice]}
        </button>
        <button className={`btn ${magnified ? 'is-on-gold' : ''}`} onClick={() => setMagnified((m) => !m)} aria-pressed={magnified} disabled={!air}>
          Bending ×100
        </button>
        <button className={`btn ${slow ? 'is-on-gold' : ''}`} onClick={() => setSlow((s) => !s)} aria-pressed={slow}>
          {slow ? 'Slow ¼×' : 'Slow motion'}
        </button>
        <BehindToggle open={panel} onToggle={togglePanel} />
      </div>
      <BehindPanel ref={panelRef} open={panel} onClose={closePanel} simulated={SIMULATED} assumed={ASSUMED}>
        <AirPlots air={air} />
      </BehindPanel>
    </>
  )
}
