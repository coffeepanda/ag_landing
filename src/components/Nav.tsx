import { href, type Route } from '../route'
import { SECTIONS } from '../site'

export default function Nav({ route }: { route: Route }) {
  return (
    <header className="nav">
      <a className="mark" href={href('')} aria-label="AG home">
        <span className="logo">AG</span>
        <span className="tag">Preview</span>
      </a>
      <nav className="tabs" aria-label="Sections">
        {SECTIONS.map((s) =>
          s.soon ? (
            <span key={s.id} className="tab is-soon" aria-disabled="true">
              {s.label}
              <sup>soon</sup>
            </span>
          ) : (
            <a
              key={s.id}
              className={`tab ${route.section === s.id ? 'is-active' : ''}`}
              href={href(s.id)}
              aria-current={route.section === s.id ? 'page' : undefined}
            >
              {s.label}
            </a>
          )
        )}
      </nav>
    </header>
  )
}
