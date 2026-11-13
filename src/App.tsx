import Nav from './components/Nav'
import Demos from './pages/Demos'
import Home from './pages/Home'
import { useRoute } from './route'

export default function App() {
  const route = useRoute()
  return (
    <>
      <Nav route={route} />
      {route.section === 'demos' ? <Demos demoId={route.demo} /> : <Home />}
    </>
  )
}
