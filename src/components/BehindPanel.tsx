import { forwardRef, useEffect, type ReactNode } from 'react'

/**
 * "Behind the scene": the same three parts for every phenomenon —
 * what is simulated, what is assumed, and a few live plots.
 * Desktop: a card on the right. Phone: a bottom sheet.
 */
type Props = {
  open: boolean
  onClose: () => void
  simulated: ReactNode
  assumed: ReactNode[]
  children: ReactNode
}

export const BehindPanel = forwardRef<HTMLElement, Props>(function BehindPanel(
  { open, onClose, simulated, assumed, children },
  ref
) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <aside
      ref={ref}
      id="behind-panel"
      className={`behind ${open ? 'is-open' : ''}`}
      aria-label="Behind the scene"
      aria-hidden={!open}
    >
      <header className="behind-head">
        <span className="behind-kicker">Behind the scene</span>
        <button className="behind-close" onClick={onClose} aria-label="Close" tabIndex={open ? 0 : -1}>
          ×
        </button>
      </header>
      <div className="behind-body">
        <section>
          <h3>What's simulated</h3>
          <p>{simulated}</p>
        </section>
        <section>
          <h3>What's assumed</h3>
          <ul>
            {assumed.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>What it shows</h3>
          {children}
        </section>
      </div>
    </aside>
  )
})

export function BehindToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className={`btn behind-toggle ${open ? 'is-on' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="behind-panel"
    >
      <span aria-hidden="true">◇</span> Behind the scene
    </button>
  )
}

/** One captioned plot inside the panel. */
export function Figure({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <figure className="fig">
      <figcaption className="fig-title">{title}</figcaption>
      {children}
      <p className="fig-caption">{caption}</p>
    </figure>
  )
}
