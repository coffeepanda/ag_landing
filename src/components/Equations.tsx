import { useEffect, useState } from 'react'

/*
 * Physical laws, cycled while the headline is hovered: one every 0.5 s. Several echo the
 * phenomena (the grating and refraction behind the Room of Light, drag-free oscillators for the
 * glasses, waves and heat). Written in plain Unicode so they set in the brand's own type.
 */
export const EQUATIONS = [
  'F = ma',
  'E = mc²',
  'd sin θ = mλ',
  'n₁ sin θ₁ = n₂ sin θ₂',
  '∂²u/∂t² = c²∇²u',
  'iħ ∂ψ/∂t = Ĥψ',
  '∇·E = ρ/ε₀',
  'mẍ + cẋ + kx = F',
  '∂T/∂t = α∇²T',
  '∇×E = −∂B/∂t',
  'p = h/λ',
  'S = k ln Ω'
]

export const EQ_MS = 500

/**
 * Cycles the equations while `active`. Each new one fades in over 120 ms (no exit animation).
 * Reduced motion holds the first equation still. Renders nothing while inactive.
 */
export default function Equations({ active }: { active: boolean }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (!active) return
    setI(0)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setI((n) => (n + 1) % EQUATIONS.length), EQ_MS)
    return () => window.clearInterval(id)
  }, [active])

  if (!active) return null
  return (
    <span className="eq" key={i}>
      {EQUATIONS[i]}
    </span>
  )
}
