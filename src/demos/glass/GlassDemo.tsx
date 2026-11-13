import { useCallback, useEffect, useRef, useState } from 'react'
import { BehindPanel, BehindToggle } from '../../components/BehindPanel'
import { GlassAudio } from './audio'
import { loadGlassSet, type Glass } from './data'
import GlassPlots from './Plots'
import type { GlassScene } from './scene'

const SIMULATED =
  'Twelve glasses, each tuned with water to one note from A4 to G#5. For every glass we computed how its bowl vibrates, then struck it with a small mallet and followed the contact. What you hear and see comes from those results.'

const ASSUMED = [
  'A simplified, straight-walled bowl and idealised water loading.',
  'Damping is fixed, not measured from real glass.',
  'The sound comes from the rim’s motion, not a microphone.',
  'On screen, the motion is magnified and slowed so you can see it.'
]

// Number row, left to right = low to high.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']

// A short phrase over the set: Am7 arpeggio, then Am7 → C → F → G → Am7.
const PHRASE: [number, number][] = [
  [0, 0], [3, 0.42], [7, 0.84], [10, 1.26],
  ...strum([0, 3, 7, 10], 2.2),
  ...strum([3, 7, 10], 4.4),
  ...strum([0, 3, 8], 6.4),
  ...strum([2, 5, 10], 8.4),
  ...strum([0, 3, 7, 10], 10.6)
]
const PHRASE_END = 14

function strum(notes: number[], at: number): [number, number][] {
  return notes.map((n, k) => [n, at + k * 0.045])
}

export default function GlassDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  const sceneRef = useRef<GlassScene | null>(null)
  const audioRef = useRef<GlassAudio | null>(null)
  const glassesRef = useRef<Glass[]>([])
  const phraseTimer = useRef<number>(0)
  const [glasses, setGlasses] = useState<Glass[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sound, setSound] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [touched, setTouched] = useState(false)
  const [panel, setPanel] = useState(false)
  const [strikeUs, setStrikeUs] = useState<number[]>([])
  const panelRef = useRef<HTMLElement>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  const getFocus = useCallback(() => sceneRef.current?.latest() ?? null, [])
  const closePanel = useCallback(() => setPanel(false), [])

  // Keep the glasses centred in whatever the panel leaves uncovered.
  useEffect(() => {
    const fit = () => {
      const s = sceneRef.current
      const el = panelRef.current
      const stage = el?.offsetParent as HTMLElement | null
      if (!s || !el || !stage) return
      if (!panel) return s.setInset(0, 0)
      const sheet = window.matchMedia('(max-width: 720px)').matches
      if (sheet) s.setInset(0, stage.clientHeight - el.offsetTop)
      else s.setInset(stage.clientWidth - el.offsetLeft, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [panel, glasses])

  // Scene: data + WebGL. three.js is only loaded with this demo.
  useEffect(() => {
    let disposed = false
    let scene: GlassScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Promise.all([loadGlassSet(), import('./scene')])
      .then(([set, mod]) => {
        if (disposed || !canvasRef.current) return
        glassesRef.current = set.glasses
        setGlasses(set.glasses)
        setStrikeUs(set.strike_us)
        scene = new mod.GlassScene(canvasRef.current, set.glasses, {
          reducedMotion,
          onFrame: (labels) => {
            labels.forEach((l, i) => {
              const el = labelRefs.current[i]
              if (!el) return
              el.style.transform = `translate(${l.x}px, ${l.y}px) translate(-50%, 0)`
              el.style.setProperty('--level', l.level.toFixed(3))
            })
          }
        })
        sceneRef.current = scene
      })
      .catch((e: unknown) => {
        console.error('[glass demo]', e)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      disposed = true
      window.clearTimeout(phraseTimer.current)
      scene?.dispose()
      audioRef.current?.dispose()
      sceneRef.current = null
      audioRef.current = null
    }
  }, [])

  /** Audio needs a user gesture; create it on the first one. */
  const audio = () => {
    if (!audioRef.current && sceneRef.current) {
      audioRef.current = new GlassAudio(glassesRef.current, sceneRef.current.pans())
      audioRef.current.muted = !soundRef.current
    }
    audioRef.current?.resume()
    return audioRef.current
  }

  const strike = (i: number, velocity = 1) => {
    if (i < 0 || i >= glassesRef.current.length) return
    setTouched(true)
    sceneRef.current?.strike(i, velocity)
    audio()?.strike(i, undefined, velocity)
  }

  const stopPhrase = () => {
    window.clearTimeout(phraseTimer.current)
    audioRef.current?.stopAll()
    sceneRef.current?.clearPending()
    setPlaying(false)
  }

  const playPhrase = () => {
    if (playing) return stopPhrase()
    const a = audio()
    const s = sceneRef.current
    if (!a || !s) return
    setTouched(true)
    const lead = 0.08
    const t0 = a.ctx.currentTime + lead
    for (const [i, dt] of PHRASE) {
      a.strike(i, t0 + dt, 0.85)
      s.strike(i, 0.85, lead + dt + (a.ctx.outputLatency || a.ctx.baseLatency || 0))
    }
    setPlaying(true)
    phraseTimer.current = window.setTimeout(() => setPlaying(false), PHRASE_END * 1000)
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !sound
  }, [sound])

  // Pointer: tap/click strikes; dragging across the row plays each glass it enters.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let down = false
    let last = -1
    const onDown = (e: PointerEvent) => {
      const s = sceneRef.current
      if (!s) return
      down = true
      canvas.setPointerCapture(e.pointerId)
      last = s.pick(e.clientX, e.clientY)
      if (last >= 0) strike(last)
    }
    const onMove = (e: PointerEvent) => {
      const s = sceneRef.current
      if (!s) return
      s.setPointer(e.clientX, e.clientY)
      const i = s.pick(e.clientX, e.clientY)
      s.setHover(e.pointerType === 'mouse' ? i : -1)
      canvas.style.cursor = i >= 0 ? 'pointer' : 'default'
      if (down && i >= 0 && i !== last) strike(i, 0.75)
      if (down) last = i
    }
    const onUp = () => {
      down = false
      last = -1
    }
    const onLeave = () => sceneRef.current?.setHover(-1)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  })

  // Keyboard: number row plays the set.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const i = KEYS.indexOf(e.key)
      if (i >= 0) {
        e.preventDefault()
        strike(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) return <div className="demo-loading">This demo needs WebGL.</div>

  return (
    <>
      <canvas ref={canvasRef} aria-label="Twelve glasses. Click or tap a glass to strike it." />
      <div className="glass-labels" aria-hidden="true">
        {glasses.map((g, i) => (
          <span key={g.note} ref={(el) => { labelRefs.current[i] = el }} className="glass-label">
            {g.note}
            <kbd>{KEYS[i]}</kbd>
          </span>
        ))}
      </div>
      <div className="demo-controls">
        <button className="btn" onClick={playPhrase} disabled={!glasses.length}>
          {playing ? 'Stop' : 'Play a phrase'}
        </button>
        <button className={`btn ${sound ? '' : 'is-off'}`} onClick={() => setSound((s) => !s)} aria-pressed={sound}>
          Sound {sound ? 'on' : 'off'}
        </button>
        <BehindToggle open={panel} onToggle={() => setPanel((p) => !p)} />
        <span className={`hint ${touched ? 'is-faded' : ''}`}>
          <span className="hint-fine">Click a glass, or drag across them · keys 1 – =</span>
          <span className="hint-coarse">Tap a glass, or slide across them</span>
        </span>
      </div>
      <BehindPanel ref={panelRef} open={panel} onClose={closePanel} simulated={SIMULATED} assumed={ASSUMED}>
        <GlassPlots glasses={glasses} strikeUs={strikeUs} getFocus={getFocus} open={panel} />
      </BehindPanel>
    </>
  )
}
