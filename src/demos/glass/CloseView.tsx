import { useCallback, useEffect, useRef, useState } from 'react'
import { BehindPanel, BehindToggle, usePanelInset } from '../../components/BehindPanel'
import { GlassAudio } from './audio'
import { loadAirField, loadClose, RIM_VISUAL, rimBound, SLOW_RING, SLOW_STRIKE, type CloseBundle } from './closeData'
import ClosePlots from './ClosePlots'
import type { CloseHud, CloseScene } from './closeScene'
import { loadGlassSet, type Glass } from './data'
import type { GlassViewProps } from './GlassDemo'

const SIMULATED =
  'One glass from the set, up close. From the bowl’s shape and the water inside, we computed the ways it can ring: rim shapes with two, three, four, five and six lobes, each at its own pitch. Then a small mallet strikes the rim, and we followed the contact, about forty millionths of a second long, to find how strongly each way of ringing is set going. From the moving wall we computed the sound it sends into the air. On the glass, colour shows the wall moving out (amber) or in (blue); on the slice of air around it, pressure pushing (amber) or pulling (blue).'

const FAMILIES: (number | null)[] = [null, 2, 3, 4, 5, 6]

export default function CloseView({ panel: { open, close, toggle }, switcher }: GlassViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<CloseScene | null>(null)
  const audioRef = useRef<GlassAudio | null>(null)
  const setRef = useRef<Glass[]>([])
  const panelRef = useRef<HTMLElement>(null)
  const hudRef = useRef<HTMLSpanElement>(null)
  const [data, setData] = useState<CloseBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [family, setFamily] = useState<number | null>(null)
  const [airOn, setAirOn] = useState(true)
  const [air, setAir] = useState<Int16Array | null>(null)
  const indexRef = useRef(0)
  indexRef.current = index
  const tRef = useRef(0)

  const playSound = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.resume()
    a.strike(indexRef.current, undefined, 0.9)
  }, [])

  useEffect(() => {
    let disposed = false
    let scene: CloseScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Promise.all([loadClose(), loadGlassSet(), import('./closeScene')])
      .then(([d, set, mod]) => {
        if (disposed || !canvasRef.current) return
        setData(d)
        setRef.current = set.glasses
        scene = new mod.CloseScene(canvasRef.current, d.glasses[0]!, {
          reducedMotion,
          onHud: (h) => {
            tRef.current = h.phase === 'approach' ? 0 : h.tUs
            if (hudRef.current) hudRef.current.textContent = hudText(h)
          },
          onStrike: playSound
        })
        sceneRef.current = scene
      })
      .catch((e: unknown) => {
        console.error('[glass close]', e)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      disposed = true
      scene?.dispose()
      audioRef.current?.dispose()
      sceneRef.current = null
      audioRef.current = null
    }
  }, [playSound])

  /** Audio needs a user gesture: create it on the first button press. */
  const ensureAudio = () => {
    if (!audioRef.current && setRef.current.length) audioRef.current = new GlassAudio(setRef.current, setRef.current.map(() => 0))
  }

  const setInset = useCallback((r: number, b: number) => sceneRef.current?.setInset(r, b), [])
  usePanelInset(panelRef, open, setInset, data)
  useEffect(() => sceneRef.current?.setFamily(family), [family, data])
  useEffect(() => sceneRef.current?.setAirVisible(airOn), [airOn, data])

  // Radiated pressure fields for the shown glass, fetched on demand.
  useEffect(() => {
    const g = data?.glasses[index]
    if (!g) return
    let stale = false
    setAir(null)
    loadAirField(g)
      .then((a) => {
        if (stale) return
        setAir(a)
        sceneRef.current?.setAir(g, a)
      })
      .catch((e: unknown) => console.error('[glass air]', e))
    return () => { stale = true }
  }, [data, index])

  const pick = (i: number) => {
    if (!data) return
    ensureAudio()
    const n = (i + data.glasses.length) % data.glasses.length
    setIndex(n)
    sceneRef.current?.setGlass(data.glasses[n]!)
    sceneRef.current?.setFamily(family)
  }

  const getTime = useCallback(() => tRef.current, [])

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

  const glass = data?.glasses[index] ?? null
  const magnify = glass ? Math.round(RIM_VISUAL / rimBound(glass) / 100) * 100 : 0
  const assumed = [
    'A simplified, straight-walled bowl whose bending shapes are prescribed; the water adds mass in a simplified way.',
    'The mallet’s tip stiffness and the glass’s damping are chosen, not measured.',
    `Motion is magnified about ${magnify.toLocaleString()}×. The strike is replayed ${SLOW_STRIKE.toLocaleString()}× slower and the ringing ${SLOW_RING}× slower; the ringing keeps its true pitch ratios.`,
    'The sound in the air comes from a simplified radiation model: every patch of the wall acts as a small source. The glass does not reflect the sound it makes.',
    'What you hear is the rim’s motion played at real speed, not a microphone recording.'
  ]

  return (
    <>
      <canvas ref={canvasRef} aria-label="One glass up close, coloured by how its wall moves after a mallet strike. Drag to look around." />
      <div className="demo-controls">
        {switcher}
        <div className="stepper" role="group" aria-label="Glass">
          <button onClick={() => pick(index - 1)} aria-label="Previous glass" disabled={!data}>‹</button>
          <span>{glass?.note ?? 'A4'}</span>
          <button onClick={() => pick(index + 1)} aria-label="Next glass" disabled={!data}>›</button>
        </div>
        <div className="view-switch families" role="radiogroup" aria-label="Ring shape">
          {FAMILIES.map((n) => (
            <button key={n ?? 'all'} role="radio" aria-checked={family === n} className={family === n ? 'is-active' : ''} onClick={() => setFamily(n)}>
              {n === null ? 'All' : `${n}`}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => { ensureAudio(); sceneRef.current?.strike() }} disabled={!data}>
          Strike
        </button>
        <button className={`btn ${airOn ? 'is-on-gold' : ''}`} onClick={() => setAirOn((a) => !a)} aria-pressed={airOn}>
          Air
        </button>
        <BehindToggle open={open} onToggle={toggle} />
        <span ref={hudRef} className="hint close-hud" aria-live="off" />
      </div>
      <BehindPanel ref={panelRef} open={open} onClose={close} simulated={SIMULATED} assumed={assumed}>
        <ClosePlots glass={glass} air={air} getTime={getTime} family={family} open={open} />
      </BehindPanel>
    </>
  )
}

function hudText(h: CloseHud) {
  const mag = `motion ×${(Math.round(h.magnify / 100) * 100).toLocaleString()}`
  if (h.phase === 'approach') return `mallet approaching · ${mag}`
  if (h.phase === 'strike') return `strike · t = ${h.tUs.toFixed(1)} µs · ${SLOW_STRIKE.toLocaleString()}× slower · ${mag}`
  return `ringing · t = ${(h.tUs / 1000).toFixed(2)} ms · ${SLOW_RING}× slower · ${mag}`
}
