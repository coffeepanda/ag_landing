/** Segmented switch between views of one phenomenon (e.g. Flight / In the air). */
export default function ViewSwitch<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div className="view-switch" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={o.id === value}
          className={o.id === value ? 'is-active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
