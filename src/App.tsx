import Nav from './components/Nav'
import Home from './pages/Home'
import Phenomena from './pages/Phenomena'
import { useRoute } from './route'
import { PHENOMENA } from './site'

export default function App() {
  const route = useRoute()
  // #/demos/... is kept as an alias for older links.
  const phenomena = route.section === PHENOMENA || route.section === 'demos'
  return (
    <>
      <Nav route={route} />
      {phenomena ? <Phenomena demoId={route.demo} /> : <Home />}
    </>
  )
}
