import { useState, type ReactNode } from 'react'
import { useBehindPanel } from '../../components/BehindPanel'
import ViewSwitch from '../../components/ViewSwitch'
import AirView from './AirView'
import FlightView from './FlightView'

export type ViewProps = {
  panel: ReturnType<typeof useBehindPanel>
  switcher: ReactNode
}

type View = 'flight' | 'air'

const VIEWS: { id: View; label: string }[] = [
  { id: 'flight', label: 'The fall' },
  { id: 'air', label: 'In the air' }
]

/**
 * The Last Leaf has two views of two separate simulations:
 * the whole fall (reduced flight), and a close-up of the air around the leaf
 * (resolved shell and air). Behind the scene follows the view.
 */
export default function LeafDemo() {
  const panel = useBehindPanel()
  const [view, setView] = useState<View>('flight')
  const switcher = <ViewSwitch label="View" value={view} options={VIEWS} onChange={setView} />
  return (
    <div className="view-stage" key={view}>
      {view === 'flight' ? <FlightView panel={panel} switcher={switcher} /> : <AirView panel={panel} switcher={switcher} />}
    </div>
  )
}
