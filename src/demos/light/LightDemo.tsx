import { useState, type ReactNode } from 'react'
import { useBehindPanel } from '../../components/BehindPanel'
import ViewSwitch from '../../components/ViewSwitch'
import { css, type Band } from './data'
import RoomView from './RoomView'
import WaveView from './WaveView'

type View = 'room' | 'grating'

const VIEWS: { id: View; label: string }[] = [
  { id: 'room', label: 'The room' },
  { id: 'grating', label: 'The grating' }
]

export type LightViewProps = {
  panel: ReturnType<typeof useBehindPanel>
  switcher: ReactNode
  band: number | null
  setBand: (b: number | null) => void
}

/**
 * A Room Made of Light: the same simulation seen at two scales. The room shows
 * where each colour lands; the grating shows the light wave splitting at the ridges.
 * The chosen colour carries across both views.
 */
export default function LightDemo() {
  const panel = useBehindPanel()
  const [view, setView] = useState<View>('room')
  const [band, setBand] = useState<number | null>(null)
  const switcher = <ViewSwitch label="View" value={view} options={VIEWS} onChange={setView} />
  return (
    <div className="view-stage" key={view}>
      {view === 'room' ? (
        <RoomView panel={panel} switcher={switcher} band={band} setBand={setBand} />
      ) : (
        <WaveView panel={panel} switcher={switcher} band={band} setBand={setBand} />
      )}
    </div>
  )
}

/** Seven colour chips plus "All" (white light). */
export function SpectrumPicker({ bands, value, onChange, allLabel }: { bands: Band[]; value: number | null; onChange: (b: number | null) => void; allLabel: string }) {
  return (
    <div className="spectrum" role="radiogroup" aria-label="Colour">
      <button role="radio" aria-checked={value === null} className={`spectrum-all ${value === null ? 'is-active' : ''}`} onClick={() => onChange(null)}>
        {allLabel}
      </button>
      {bands.map((b, i) => (
        <button
          key={b.nm}
          role="radio"
          aria-checked={value === i}
          aria-label={`${b.nm} nanometres`}
          title={`${b.nm} nm`}
          className={`spectrum-dot ${value === i ? 'is-active' : ''}`}
          style={{ ['--c' as string]: css(b.rgb) }}
          onClick={() => onChange(value === i ? null : i)}
        />
      ))}
    </div>
  )
}
