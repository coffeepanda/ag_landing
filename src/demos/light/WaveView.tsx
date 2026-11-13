import { useCallback, useEffect, useRef, useState } from 'react'
import { BehindPanel, BehindToggle, usePanelInset } from '../../components/BehindPanel'
import { loadRoom, loadWave, type Room } from './data'
import { SpectrumPicker, type LightViewProps } from './LightDemo'
import { GratingPlots } from './Plots'
import type { WaveHud, WaveScene } from './waveScene'

const SIMULATED =
  'A few periods of the window’s surface: glass ridges one micrometre apart and 0.3 µm tall, lit from inside the glass. We solved Maxwell’s equations for the light wave across the ridges, for each of the seven colours. What moves here is that solution: the wave rising through the glass, splitting at the ridges, and leaving into the air in several directions at once.'

const ASSUMED = [
  'The surface repeats forever sideways; a real window has edges.',
  'One polarisation is shown: the electric field along the grooves. The room uses the average of both.',
  'Light oscillates about 500 trillion times a second; here it is slowed by roughly 10¹⁵ so you can see it.',
  'In “White”, the seven colours are drawn together, each moving at its own rhythm.'
]

export default function WaveView({ panel: { open, close, toggle }, switcher, band, setBand }: LightViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<WaveScene | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let scene: WaveScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    Promise.all([loadWave(), loadRoom(), import('./waveScene')])
      .then(([w, r, mod]) => {
        if (disposed || !canvasRef.current) return
        setRoom(r)
        scene = new mod.WaveScene(canvasRef.current, w, r.bands, { reducedMotion, onHud: (h) => drawHud(hudRef.current, h) })
        sceneRef.current = scene
        setReady(true)
      })
      .catch((e: unknown) => {
        console.error('[light wave]', e)
        setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      disposed = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [])

  const setInset = useCallback((r: number, b: number) => sceneRef.current?.setInset(r, b), [])
  usePanelInset(panelRef, open, setInset, ready)
  useEffect(() => sceneRef.current?.setBand(band), [band, ready])

  if (error)
    return (
      <>
        <div className="demo-loading">This view could not load.</div>
        <div className="demo-controls">{switcher}</div>
      </>
    )

  return (
    <>
      <canvas ref={canvasRef} aria-label="The light wave crossing the grating's ridges and splitting into colours." />
      <div ref={hudRef} className="wave-hud" aria-hidden="true" />
      <div className="demo-controls">
        {switcher}
        {room && <SpectrumPicker bands={room.bands} value={band} onChange={setBand} allLabel="White" />}
        <BehindToggle open={open} onToggle={toggle} />
      </div>
      <BehindPanel ref={panelRef} open={open} onClose={close} simulated={SIMULATED} assumed={ASSUMED}>
        <GratingPlots room={room} band={band} />
      </BehindPanel>
    </>
  )
}

/** Place labels and the 1 µm scale bar without React re-renders. */
function drawHud(el: HTMLDivElement | null, hud: WaveHud) {
  if (!el) return
  const labels = hud.filter((h) => h.label !== '|bar')
  const bar = hud.filter((h) => h.label === '|bar')
  while (el.children.length < labels.length + 1) el.appendChild(document.createElement('span'))
  for (let i = 0; i < el.children.length; i++) {
    const s = el.children[i] as HTMLSpanElement
    if (i < labels.length) {
      const h = labels[i]!
      s.className = /^[+-]?\d$/.test(h.label) ? 'wave-label is-order' : 'wave-label'
      s.textContent = h.label
      s.style.transform = `translate(${h.x}px, ${h.y}px) translate(-50%, -50%)`
      s.style.display = ''
    } else if (i === labels.length && bar.length === 2) {
      const [a, b] = bar as [WaveHud[number], WaveHud[number]]
      s.className = 'wave-bar'
      s.textContent = '1 µm'
      s.style.transform = `translate(${a.x}px, ${a.y}px)`
      s.style.width = `${b.x - a.x}px`
      s.style.display = ''
    } else s.style.display = 'none'
  }
}
