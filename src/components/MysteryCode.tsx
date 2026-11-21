import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * "Mystery code": hovering the headline (tapping it on touch screens, focusing it by keyboard)
 * types a short snippet under it, a hint at what AG is for without explaining it. A caret keeps
 * blinking on the last line once it is written. Reduced motion shows the finished snippet at once.
 */

/** A run of text and its role: k keyword (ink), s the slot (see `slot`), default muted. */
type Seg = [text: string, role?: 'k' | 's']
type Line = Seg[]

const CODE: Line[] = [
  [['while', 'k'], [' (unknown) {']],
  [['  world = agent.'], ['simulate', 'k'], ['('], ['question', 's'], [')']],
  [['  '], ['see', 'k'], ['(world)']],
  [['}']]
]

const CHAR_MS = 24
const LINE_PAUSE = 140

const lineText = (l: Line) => l.map((s) => s[0]).join('')

/** When each line starts and how long it types for. */
function schedule(lines: Line[]) {
  let t = 0
  return lines.map((l, i) => {
    if (i) t += LINE_PAUSE
    const start = t
    const dur = lineText(l).length * CHAR_MS
    t += dur
    return { start, dur }
  })
}
const SCHEDULE = schedule(CODE)
const TOTAL = SCHEDULE[SCHEDULE.length - 1]!.start + SCHEDULE[SCHEDULE.length - 1]!.dur

export default function MysteryCode({
  children,
  slot,
  after,
  onOpenChange
}: {
  children: ReactNode
  /** Once the snippet is written, replaces the `question` argument (e.g. cycling equations). */
  slot?: (written: boolean) => ReactNode
  /** Rendered as an extra line under the code. */
  after?: (written: boolean) => ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [t, setT] = useState(0)
  const raf = useRef(0)
  const lastPointer = useRef<string>('mouse')

  useEffect(() => onOpenChange?.(open), [open, onOpenChange])

  // Types from the start each time it opens; replaying is part of the fun.
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    setT(0)
    if (!open) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(TOTAL)
      return
    }
    const t0 = performance.now()
    const tick = () => {
      const e = performance.now() - t0
      setT(Math.min(e, TOTAL))
      if (e < TOTAL) raf.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf.current)
  }, [open])

  const written = open && t >= TOTAL
  const lines = CODE.map((line, i) => {
    const { start, dur } = SCHEDULE[i]!
    if (!open || t < start) return null
    let shown = Math.floor(((t - start) / dur) * lineText(line).length)
    return line.map(([txt, role], k) => {
      const part = txt.slice(0, Math.max(0, shown))
      shown -= txt.length
      if (role === 's' && written && slot) return <span key={k} className="mc-s">{slot(true)}</span>
      return part ? <span key={k} className={role ? `mc-${role}` : undefined}>{part}</span> : null
    })
  })
  const caretAt = lines.reduce((at, n, i) => (n === null ? at : i), -1)
  const extra = after?.(written)

  return (
    <div
      className={`hero ${open ? 'is-open' : ''}`}
      tabIndex={0}
      onPointerDown={(e) => (lastPointer.current = e.pointerType)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
      onClick={() => lastPointer.current !== 'mouse' && setOpen((o) => !o)}
      // Keyboard focus opens it; a tap or click also focuses, and is handled above instead.
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <pre className="mystery" aria-hidden="true">
        {lines.map((n, i) =>
          n === null ? null : (
            <span key={i} className="mc-line">
              {n}
              {i === caretAt && !extra && <i className={`mc-caret ${written ? 'is-idle' : ''}`} />}
              {'\n'}
            </span>
          )
        )}
        {extra && <span className="mc-after">{extra}</span>}
      </pre>
    </div>
  )
}
