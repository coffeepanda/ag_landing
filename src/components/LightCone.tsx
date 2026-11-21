import { useEffect, useRef } from 'react'

/*
 * The AG Physics app mark, inlined from ag-physics-design/assets/icons/app/light-cone.svg
 * (ed090f8, 2026-11-20). SMIL only; reduced motion holds the rest frame at 0 s.
 */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" data-agp-icon="light-cone" data-agp-rest="0" aria-hidden="true">
  <ellipse cx="12" cy="12" rx="9" ry="2.1" fill="currentColor" opacity=".08"/>
  <path d="M5 4.2 19 19.8M19 4.2 5 19.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="12" cy="4.2" rx="7" ry="1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse cx="12" cy="19.8" rx="7" ry="1.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>
  <ellipse style="stroke:var(--agp-icon-accent,#E5562A)" data-agp-role="accent" cx="12" cy="8.1" rx="3.5" ry=".85" fill="none" stroke-width="1.2"><animate attributeName="cy" values="8.1;4.2;12;8.1" keyTimes="0;.5;.501;1" repeatCount="indefinite" dur="2.4s"/><animate attributeName="rx" values="3.5;7;0;3.5" keyTimes="0;.5;.501;1" repeatCount="indefinite" dur="2.4s"/><animate attributeName="ry" values=".85;1.7;0;.85" keyTimes="0;.5;.501;1" repeatCount="indefinite" dur="2.4s"/><animate attributeName="opacity" values=".85;0;1;.85" keyTimes="0;.5;.501;1" repeatCount="indefinite" dur="2.4s"/></ellipse>
  <circle style="fill:var(--agp-icon-accent,#E5562A)" data-agp-role="accent" cx="12" cy="12" r="1.7"/>
</svg>`

export default function LightCone({ className = 'cone' }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      if (reduce.matches) {
        svg.setCurrentTime(0)
        svg.pauseAnimations()
      } else svg.unpauseAnimations()
    }
    sync()
    reduce.addEventListener('change', sync)
    return () => reduce.removeEventListener('change', sync)
  }, [])
  return <span ref={ref} className={className} dangerouslySetInnerHTML={{ __html: SVG }} />
}
