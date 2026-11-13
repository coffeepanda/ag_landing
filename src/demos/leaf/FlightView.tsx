import { useCallback, useEffect, useRef, useState } from 'react'
import { BehindPanel, BehindToggle, usePanelInset } from '../../components/BehindPanel'
import type { ViewProps } from './LeafDemo'
import { loadLeaf, type LeafBundle } from './data'
import LeafPlots from './Plots'
import type { LeafScene } from './scene'

const SIMULATED =
  'One leaf, 6 by 8 centimetres and 0.15 grams, lets go three metres up in a gentle breeze. We computed how it moves, turns, bends and twists, all together, every step of the way down until it reaches the ground about four seconds later.'

const ASSUMED = [
  'The air’s push on the leaf follows simplified laws. The airflow itself is not simulated in this flight.',
  'The leaf’s stiffness and damping are chosen, not measured from a real leaf.',
  'The breeze is gentle and prescribed; there is no turbulence.',
  'The shape is designed, not scanned. Its colour and veins are painted on.',
  'Bending is shown at true scale. The flight ends as the leaf reaches the ground.'
]

export default function FlightView({ panel: { open: panel, close: closePanel, toggle: togglePanel }, switcher }: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<LeafScene | null>(null)
  const rangeRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [bundle, setBundle] = useState<LeafBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Slow motion by default: the fall reads far better at a quarter speed.
  const [slow, setSlow] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [landed, setLanded] = useState(false)
  const state = useRef({ playing: true, landed: false, scrubbing: false, wasPlaying: true })

  useEffect(() => {
    let disposed = false
    let scene: LeafScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Promise.all([loadLeaf(), import('./scene')])
      .then(([b, mod]) => {
        if (disposed || !canvasRef.current) return
        setBundle(b)
        scene = new mod.LeafScene(canvasRef.current, b, {
          reducedMotion,
          onTick: ({ t, playing: p, landed: l }) => {
            if (rangeRef.current && !state.current.scrubbing) rangeRef.current.value = String(t)
            if (timeRef.current) timeRef.current.textContent = `${t.toFixed(2)} s`
            if (p !== state.current.playing) { state.current.playing = p; setPlaying(p) }
            if (l !== state.current.landed) { state.current.landed = l; setLanded(l) }
          }
        })
        sceneRef.current = scene
      })
      .catch((e: unknown) => {
        console.error('[leaf demo]', e)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      disposed = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  const setInset = useCallback((r: number, b: number) => sceneRef.current?.setInset(r, b), [])
  usePanelInset(panelRef, panel, setInset, bundle)

  useEffect(() => sceneRef.current?.setSpeed(slow ? 0.25 : 1), [slow, bundle])

  const getTime = useCallback(() => sceneRef.current?.time ?? 0, [])
  const seek = useCallback((t: number) => {
    sceneRef.current?.seek(t)
    sceneRef.current?.setPlaying(false)
  }, [])

  const letGo = () => sceneRef.current?.letGo()
  const togglePlay = () => {
    const s = sceneRef.current
    if (!s) return
    s.setPlaying(!(state.current.playing))
  }

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
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      sceneRef.current?.zoomBy(Math.exp(e.deltaY * 0.001))
    }
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

  // Space: pause / play. Enter: let go again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
      if (e.key === 'Enter') letGo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) return <div className="demo-loading">This demo needs WebGL.</div>

  return (
    <>
      <canvas ref={canvasRef} aria-label="A leaf falling from a branch. Drag to look around." />
      <div className="demo-controls">
        {switcher}
        <div className="timeline">
          <button className="btn btn-icon" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} disabled={!bundle}>
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            ref={rangeRef}
            type="range"
            min={0}
            max={bundle?.duration ?? 4}
            step={0.001}
            defaultValue={0}
            aria-label="Time"
            onPointerDown={() => {
              state.current.scrubbing = true
              state.current.wasPlaying = state.current.playing
              sceneRef.current?.setPlaying(false)
            }}
            onPointerUp={() => {
              state.current.scrubbing = false
              if (state.current.wasPlaying) sceneRef.current?.setPlaying(true)
            }}
            onInput={(e) => sceneRef.current?.seek(+(e.target as HTMLInputElement).value)}
          />
          <span ref={timeRef} className="timeline-t">0.00 s</span>
        </div>
        <button className="btn" onClick={letGo} disabled={!bundle}>{landed ? 'Again' : 'Let go'}</button>
        <button className={`btn ${slow ? 'is-on-gold' : ''}`} onClick={() => setSlow((s) => !s)} aria-pressed={slow}>
          {slow ? 'Slow ¼×' : 'Slow motion'}
        </button>
        <BehindToggle open={panel} onToggle={togglePanel} />
      </div>
      <BehindPanel ref={panelRef} open={panel} onClose={closePanel} simulated={SIMULATED} assumed={ASSUMED}>
        <LeafPlots bundle={bundle} getTime={getTime} onSeek={seek} open={panel} />
      </BehindPanel>
    </>
  )
}
