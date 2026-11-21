import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * "Mystery code": hovering the headline (tapping it on touch screens, focusing it by keyboard)
 * reveals a short snippet under it, a hint at what AG is for without explaining it.
 * The snippet is written in, decoded or faded in, then a caret keeps blinking on the last line.
 * Reduced motion shows the finished snippet at once.
 */

/** A run of text and its role: k keyword (ink), c comment (faint), a live (accent), default muted. */
type Seg = [text: string, role?: 'k' | 'c' | 'a']
type Line = { segs: Seg[]; instant?: boolean; pause?: number }
type Mode = 'type' | 'decode' | 'fade'
export type Snippet = { mode: Mode; lines: Line[] }

const L = (...segs: Seg[]): Line => ({ segs })

export const SNIPPETS = {
  code: {
    mode: 'type',
    lines: [
      L(['while', 'k'], [' (unknown) {']),
      L(['  world = agent.'], ['simulate', 'k'], ['(question)']),
      L(['  '], ['see', 'k'], ['(world)']),
      L(['}'])
    ]
  },
  function: {
    mode: 'fade',
    lines: [
      L(['// ask anything. an agent builds the world.', 'c']),
      L(['function', 'k'], [' into(the: '], ['Unknown', 'k'], ['): Insight'])
    ]
  },
  decode: {
    mode: 'decode',
    lines: [
      L(['question', 'k'], ['  →  '], ['simulation', 'k'], ['  →  '], ['insight', 'k']),
      L(['// physics, written by agents', 'c'])
    ]
  },
  terminal: {
    mode: 'type',
    lines: [
      L(['$ ', 'c'], ['ag', 'k'], [' "what happens when a leaf lets go?"']),
      { segs: [['  ▸ writing the simulation   ', 'c'], ['ok']], instant: true, pause: 700 },
      { segs: [['  ▸ running                  ', 'c'], ['4.1 s']], instant: true, pause: 900 },
      { segs: [['  ▸ result                   ', 'c'], ['●', 'a']], instant: true, pause: 600 }
    ]
  }
} satisfies Record<string, Snippet>

const CHAR_MS = 24
const LINE_PAUSE = 140
const GLYPHS = '▓▒░<>/\\{}[]=+*#01λΣ∂ψ∇'

const lineText = (l: Line) => l.segs.map((s) => s[0]).join('')

/** When each line starts and how long it takes, for the typed mode. */
function schedule(lines: Line[]) {
  let t = 0
  return lines.map((l) => {
    t += l.pause ?? (t ? LINE_PAUSE : 0)
    const start = t
    const dur = l.instant ? 0 : lineText(l).length * CHAR_MS
    t += dur
    return { start, dur }
  })
}

function totalMs(s: Snippet) {
  if (s.mode === 'fade') return s.lines.length * 140 + 320
  if (s.mode === 'decode') return 300 + s.lines.reduce((n, l) => n + lineText(l).length, 0) * 16
  const sch = schedule(s.lines)
  const last = sch[sch.length - 1]!
  return last.start + last.dur
}

/** Renders one line at time t (ms since reveal). Returns null while the line hasn't started. */
function renderLine(s: Snippet, i: number, t: number, offset: number, sch: ReturnType<typeof schedule>): ReactNode {
  const line = s.lines[i]!
  if (s.mode === 'fade') return line.segs.map(([txt, r], k) => <span key={k} className={r ? `mc-${r}` : undefined}>{txt}</span>)

  if (s.mode === 'type') {
    const { start, dur } = sch[i]!
    if (t < start) return null
    let shown = dur === 0 ? Infinity : Math.floor(((t - start) / dur) * lineText(line).length)
    return line.segs.map(([txt, r], k) => {
      const part = txt.slice(0, Math.max(0, shown))
      shown -= txt.length
      return part ? <span key={k} className={r ? `mc-${r}` : undefined}>{part}</span> : null
    })
  }

  // decode: every character scrambles in a left-to-right wave, then settles to its glyph.
  let idx = offset
  return line.segs.map(([txt, r], k) => {
    const out = Array.from(txt, (ch) => {
      const n = idx++
      if (ch === ' ') return ' '
      const appear = n * 5
      const settle = 300 + n * 16
      if (t < appear) return ' '
      if (t >= settle) return ch
      return GLYPHS[(n * 7 + Math.floor(t / 45)) % GLYPHS.length]
    }).join('')
    return <span key={k} className={r ? `mc-${r}` : undefined}>{out}</span>
  })
}

export default function MysteryCode({ snippet, children }: { snippet: Snippet; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [t, setT] = useState(0)
  const raf = useRef(0)
  const lastPointer = useRef<string>('mouse')
  const reduce = useRef(false)
  const done = totalMs(snippet)

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Play from the start each time it opens; replaying is part of the fun.
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (!open) return
    if (reduce.current) {
      setT(done)
      return
    }
    const t0 = performance.now()
    const tick = () => {
      const e = performance.now() - t0
      setT(Math.min(e, done))
      if (e < done) raf.current = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf.current)
  }, [open, done, snippet])

  const sch = schedule(snippet.lines)
  let offset = 0
  const lines = snippet.lines.map((l, i) => {
    const node = renderLine(snippet, i, t, offset, sch)
    offset += lineText(l).length
    return node
  })
  // The caret sits on the last line that has started.
  let caretAt = -1
  lines.forEach((n, i) => {
    if (n !== null) caretAt = i
  })
  const finished = t >= done

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
      <pre className={`mystery mystery-${snippet.mode}`} aria-hidden="true">
        {lines.map((n, i) =>
          n === null ? null : (
            <span key={i} className="mc-line" style={snippet.mode === 'fade' ? { animationDelay: `${i * 140}ms` } : undefined}>
              {n}
              {i === caretAt && <i className={`mc-caret ${finished ? 'is-idle' : ''}`} />}
              {'\n'}
            </span>
          )
        )}
      </pre>
    </div>
  )
}
