import { LOOKS, setLook, useLook } from '../theme/look'

/** PROTOTYPE control: switches between the three brand looks. Not part of the site. */
export default function LookSwitch() {
  const look = useLook()
  return (
    <div className="look-switch" role="radiogroup" aria-label="Prototype look">
      <span className="look-switch-k">Look</span>
      {LOOKS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={look === l.id}
          className={look === l.id ? 'is-active' : ''}
          onClick={() => setLook(l.id)}
          title={l.label}
        >
          {l.id.toUpperCase()}
          <span className="look-switch-name">{l.label}</span>
        </button>
      ))}
    </div>
  )
}
