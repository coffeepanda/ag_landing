import { useState } from 'react'

/**
 * PROTOTYPE control: a numbered pill in the top bar for comparing variations of one thing.
 * The choice comes from ?<param>=<id>, then localStorage, then the first option.
 * Remove it (and its callers' extra options) once a variation is chosen.
 */
export type ProtoOption<T extends string> = { id: T; label: string }

export function useProtoChoice<T extends string>(param: string, options: readonly ProtoOption<T>[]) {
  const key = `ag-proto-${param}`
  const valid = (v: unknown): v is T => options.some((o) => o.id === v)
  const [value, setValue] = useState<T>(() => {
    const q = new URLSearchParams(window.location.search).get(param)
    if (valid(q)) return q
    try {
      const s = localStorage.getItem(key)
      if (valid(s)) return s
    } catch {}
    return options[0]!.id
  })
  const choose = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, v)
    } catch {}
  }
  return [value, choose] as const
}

export default function ProtoSwitch<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: readonly ProtoOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="proto-switch" role="radiogroup" aria-label={`Prototype ${label}`}>
      <span className="proto-switch-k">{label}</span>
      {options.map((o, i) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'is-active' : ''}
          onClick={() => onChange(o.id)}
          title={o.label}
        >
          {i + 1}
          <span className="proto-switch-name">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
