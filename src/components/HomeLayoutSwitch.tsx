import { useEffect, useState } from 'react'

/**
 * PROTOTYPE: home page layouts to compare. Sets data-home on <html>; brand.css does the rest.
 * Pick with ?home=fit|fill|cinema|frame or this switch. Remove once one is chosen.
 */
export const HOME_LAYOUTS = [
  { id: 'fit', n: '1', label: '16:9 beside the headline' },
  { id: 'fill', n: '2', label: 'Fill the column' },
  { id: 'cinema', n: '3', label: 'Cinema band, text below' },
  { id: 'frame', n: '4', label: 'Headline inside the frame' }
] as const
type Layout = (typeof HOME_LAYOUTS)[number]['id']

const KEY = 'ag-home-layout'
const isLayout = (v: unknown): v is Layout => HOME_LAYOUTS.some((l) => l.id === v)

function initial(): Layout {
  const q = new URLSearchParams(window.location.search).get('home')
  if (isLayout(q)) return q
  try {
    const s = localStorage.getItem(KEY)
    if (isLayout(s)) return s
  } catch {}
  return 'fit'
}

export default function HomeLayoutSwitch() {
  const [layout, setLayout] = useState<Layout>(initial)

  useEffect(() => {
    document.documentElement.dataset.home = layout
    try {
      localStorage.setItem(KEY, layout)
    } catch {}
    return () => {
      delete document.documentElement.dataset.home
    }
  }, [layout])

  return (
    <div className="proto-switch" role="radiogroup" aria-label="Prototype home layout">
      <span className="proto-switch-k">Layout</span>
      {HOME_LAYOUTS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={layout === l.id}
          className={layout === l.id ? 'is-active' : ''}
          onClick={() => setLayout(l.id)}
          title={l.label}
        >
          {l.n}
          <span className="proto-switch-name">{l.label}</span>
        </button>
      ))}
    </div>
  )
}
