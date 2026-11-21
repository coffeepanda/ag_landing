import { useEffect, useRef, useState } from 'react'
import Equations from '../components/Equations'
import MysteryCode from '../components/MysteryCode'
import ProtoSwitch, { useProtoChoice } from '../components/ProtoSwitch'
import { CONTACT } from '../site'

/* PROTOTYPE: where the equations cycle while the headline is hovered. Keep one, then drop the switch. */
const EQ_OPTIONS = [
  { id: 'inline', label: 'In the code: simulate(…)' },
  { id: 'line', label: 'Its own line under the code' },
  { id: 'screen', label: 'On the screen, large' }
] as const

export default function Home() {
  const [place, setPlace] = useProtoChoice('eq', EQ_OPTIONS)
  const [open, setOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      if (reduce.matches) video.pause()
      else void video.play().catch(() => {})
    }
    sync()
    reduce.addEventListener('change', sync)
    return () => reduce.removeEventListener('change', sync)
  }, [])

  return (
    <main className={`stage eq-${place}-place`}>
      <video
        ref={videoRef}
        className={`void ${ready ? 'is-ready' : ''}`}
        poster="/media/poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onPlaying={() => setReady(true)}
      >
        <source src="/media/unknown.webm" type="video/webm" />
        <source src="/media/unknown.mp4" type="video/mp4" />
      </video>
      <div className="vignette" aria-hidden="true" />

      {place === 'screen' && (
        <div className="screen-eq" aria-hidden="true">
          <Equations active={open} />
        </div>
      )}

      <MysteryCode
        onOpenChange={setOpen}
        slot={place === 'inline' ? (w) => <Equations active={w} /> : undefined}
        after={place === 'line' ? (w) => w && <Equations active className="eq-line" /> : undefined}
      >
        <h1 className="title">
          Into The <em>Unknown<i className="hero-caret" aria-hidden="true" /></em>
        </h1>
      </MysteryCode>

      <footer className="foot">
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        <span>© {new Date().getFullYear()} AIperture. All rights reserved.</span>
      </footer>
      <ProtoSwitch label="Equations" options={EQ_OPTIONS} value={place} onChange={setPlace} />
    </main>
  )
}
