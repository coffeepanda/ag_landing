import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { href } from '../route'
import { DEFAULT_DEMO, DEMOS, type Demo } from '../site'

const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>()
function demoComponent(demo: Demo) {
  if (!demo.load) return null
  let c = lazyCache.get(demo.id)
  if (!c) {
    c = lazy(demo.load)
    lazyCache.set(demo.id, c)
  }
  return c
}

export default function Demos({ demoId }: { demoId?: string }) {
  const demo = DEMOS.find((d) => d.id === demoId) ?? DEMOS.find((d) => d.id === DEFAULT_DEMO)!
  const View = demoComponent(demo)

  return (
    <main className="demo-page">
      <nav className="strip" aria-label="Demos">
        {DEMOS.map((d) => (
          <a
            key={d.id}
            href={href('demos', d.id)}
            className={`chip-link ${d.id === demo.id ? 'is-active' : ''} ${d.load ? '' : 'is-soon'}`}
            aria-current={d.id === demo.id ? 'page' : undefined}
          >
            <span className="num">{d.num}</span>
            {d.label}
          </a>
        ))}
      </nav>

      <section className="demo-stage" key={demo.id}>
        {View ? (
          <Suspense fallback={<div className="demo-loading">Loading</div>}>
            <View />
          </Suspense>
        ) : (
          <div className="demo-soon" aria-hidden="true" />
        )}

        <div className="demo-copy">
          <h1 className="demo-title">
            {demo.title[0]}
            <em>{demo.title[1]}</em>
            {demo.title[2]}
          </h1>
          <p className="demo-line">{View ? demo.line : 'In preparation.'}</p>
        </div>

        {View && <span className="demo-credit">Simulated with AG</span>}
      </section>
    </main>
  )
}
