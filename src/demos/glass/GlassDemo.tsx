import { useState, type ReactNode } from 'react'
import { useBehindPanel } from '../../components/BehindPanel'
import ViewSwitch from '../../components/ViewSwitch'
import CloseView from './CloseView'
import SetView from './SetView'

export type GlassViewProps = {
  panel: ReturnType<typeof useBehindPanel>
  switcher: ReactNode
}

type View = 'set' | 'close'

const VIEWS: { id: View; label: string }[] = [
  { id: 'set', label: 'The set' },
  { id: 'close', label: 'Up close' }
]

/**
 * The Singing Glass: the playable set of twelve, and one glass up close with its
 * simulated displacement field, the mallet strike and each way it rings.
 */
export default function GlassDemo() {
  const panel = useBehindPanel()
  const [view, setView] = useState<View>('set')
  const switcher = <ViewSwitch label="View" value={view} options={VIEWS} onChange={setView} />
  return (
    <div className="view-stage" key={view}>
      {view === 'set' ? <SetView panel={panel} switcher={switcher} /> : <CloseView panel={panel} switcher={switcher} />}
    </div>
  )
}
