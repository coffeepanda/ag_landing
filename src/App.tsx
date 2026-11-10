import { useEffect, useRef, useState } from 'react'

const CONTACT = 'contact@aiperture.io'

export default function App() {
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

      <header className="mark">
        <span className="logo">AG</span>
        <span className="tag">Preview</span>
      </header>

      <h1 className="title">
        Into The <em>Unknown</em>
      </h1>

      <footer className="foot">
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        <span>© {new Date().getFullYear()} AIperture. All rights reserved.</span>
      </footer>
    </main>
  )
}
