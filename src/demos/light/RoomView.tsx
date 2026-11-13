import { useCallback, useEffect, useRef, useState } from 'react'
import { BehindPanel, BehindToggle, usePanelInset } from '../../components/BehindPanel'
import { loadRoom, loadSculpture, type Room } from './data'
import { SpectrumPicker, type LightViewProps } from './LightDemo'
import { RoomPlots } from './Plots'
import type { RainbowBuild } from './rainbow'
import type { RoomScene } from './roomScene'

const SIMULATED =
  'Sunlight meets a tall, narrow window whose glass is etched with a fine grating: a thousand ridges per millimetre. We solved how the light wave scatters off those ridges, colour by colour across the visible spectrum. Here, that result is carried across the room: each colour leaves at its own angle and with its own strength, and lands as a continuous rainbow on the floor, the walls and the head.'

const ASSUMED = [
  'The grating was solved at seven colours; strengths between them are blended. The angles follow exactly from the 1 µm ridge spacing.',
  'Sunlight meets the grating straight on, as simulated. The window’s place and tilt are chosen for this view; “Sun height” tilts the window and the sun together.',
  'Where light lands is traced in your browser to its first landing. Light bouncing on from walls is not shown, and the head casts no shadow.',
  'A sun-like spectrum with perfectly parallel light. Wall and object colours follow simple, smooth curves.',
  'The head is a public-domain scan of a plaster cast of the Doryphoros (Polykleitos), shown as plain plaster.'
]

export default function RoomView({ panel: { open, close, toggle }, switcher, band, setBand }: LightViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<RoomScene | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [build, setBuild] = useState<RainbowBuild | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rays, setRays] = useState(true)
  const [tilt, setTilt] = useState(40)

  useEffect(() => {
    let disposed = false
    let scene: RoomScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Promise.all([loadRoom(), loadSculpture().catch(() => null), import('./roomScene')])
      .then(([r, s, mod]) => {
        if (disposed || !canvasRef.current) return
        setRoom(r)
        scene = new mod.RoomScene(canvasRef.current, r, s, { reducedMotion, onBuild: setBuild })
        sceneRef.current = scene
      })
      .catch((e: unknown) => {
        console.error('[light room]', e)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      disposed = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  const setInset = useCallback((r: number, b: number) => sceneRef.current?.setInset(r, b), [])
  usePanelInset(panelRef, open, setInset, room)
  useEffect(() => sceneRef.current?.setBand(band), [band, room])
  useEffect(() => sceneRef.current?.setRays(rays), [rays, room])

  // Rebuild at most once per frame while the slider moves.
  const pending = useRef(0)
  useEffect(() => {
    cancelAnimationFrame(pending.current)
    pending.current = requestAnimationFrame(() => sceneRef.current?.setTilt(tilt))
  }, [tilt])

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
      <canvas ref={canvasRef} aria-label="A room and a sculpture lit by a rainbow from a grating window. Drag to look around." />
      <div className="demo-controls">
        {switcher}
        {room && <SpectrumPicker bands={room.bands} value={band} onChange={setBand} allLabel="All" />}
        <label className="slider">
          <span>Sun height</span>
          <input type="range" min={28} max={56} step={0.5} value={tilt} onChange={(e) => setTilt(+e.target.value)} aria-label="Sun height in degrees" />
          <span className="slider-v">{Math.round(tilt)}°</span>
        </label>
        <button className={`btn ${rays ? 'is-on-gold' : ''}`} onClick={() => setRays((r) => !r)} aria-pressed={rays}>
          Rays
        </button>
        <BehindToggle open={open} onToggle={toggle} />
      </div>
      <BehindPanel ref={panelRef} open={open} onClose={close} simulated={SIMULATED} assumed={ASSUMED}>
        <RoomPlots room={room} band={band} budget={build ? { rows: build.budget, input: build.input, tilt } : null} />
      </BehindPanel>
    </>
  )
}
