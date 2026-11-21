import { useEffect, useRef, useState } from 'react'
import MysteryCode, { SNIPPETS } from '../components/MysteryCode'
import ProtoSwitch, { useProtoChoice } from '../components/ProtoSwitch'
import { CONTACT } from '../site'

/* PROTOTYPE: the hover snippet's variations. Keep one, then drop the switch. */
const CODE_OPTIONS = [
  { id: 'code', label: '[Code] a loop that simulates' },
  { id: 'function', label: '[Function] a signature' },
  { id: 'decode', label: 'Decoded from glyphs' },
  { id: 'terminal', label: 'A terminal run' }
] as const

export default function Home() {
  const [variant, setVariant] = useProtoChoice('snippet', CODE_OPTIONS)
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
    <main className="stage">
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

      <MysteryCode snippet={SNIPPETS[variant]}>
        <h1 className="title">
          Into The <em>Unknown<i className="hero-caret" aria-hidden="true" /></em>
        </h1>
      </MysteryCode>

      <footer className="foot">
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        <span>© {new Date().getFullYear()} AIperture. All rights reserved.</span>
      </footer>
      <ProtoSwitch label="Code" options={CODE_OPTIONS} value={variant} onChange={setVariant} />
    </main>
  )
}
