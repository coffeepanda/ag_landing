
import React from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

const items = [
  { id: 'intro', title: 'Introduction' },
  { id: 'getting-started', title: 'Getting Started' },
  { id: 'concepts', title: 'Core Concepts' },
  { id: 'components', title: 'UI Components' },
  { id: 'theming', title: 'Theming' },
  { id: 'routing', title: 'Routing & Pages' },
  { id: 'deploy', title: 'Build & Deploy' },
]

const Section: React.FC<{ id: string; title: string; children?: React.ReactNode }> = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-2xl font-bold mt-10">{title}</h2>
    <div className="prose prose-slate mt-3">{children}</div>
  </section>
)

const Docs: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto px-6 container-max grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 py-10">
          {/* Sidebar */}
          <aside className="md:sticky md:top-20 md:h-[calc(100vh-6rem)] md:overflow-auto">
            <nav className="space-y-2">
              {items.map((it) => (
                <a key={it.id} href={`#${it.id}`} className="block px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700">
                  {it.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">AetherGraph Docs</h1>
            <p className="text-slate-700 mt-2">Start with the basics, then grow into your own system. These docs mirror the landing page’s theme and layout.</p>

            <Section id="intro" title="Introduction">
              <p>AetherGraph turns Python functions into interactive, auditable workflows. Bring your own stack; add channels, artifacts, memory, and approvals only when needed.</p>
            </Section>

            <Section id="getting-started" title="Getting Started">
              <ol>
                <li>Install dependencies: <code>pnpm i</code></li>
                <li>Run dev server: <code>pnpm dev</code></li>
                <li>Edit components under <code>src/components</code> and pages under <code>src/pages</code>.</li>
              </ol>
            </Section>

            <Section id="concepts" title="Core Concepts">
              <ul>
                <li><strong>Decorator-first agents</strong>: wrap a function to gain interactive runs and memory.</li>
                <li><strong>Artifacts</strong>: explicitly save charts/tables/logs for provenance.</li>
                <li><strong>Channels</strong>: Slack/CLI messaging, progress, approvals.</li>
              </ul>
            </Section>

            <Section id="components" title="UI Components">
              <p>Header, Hero, Sections, Waitlist, Footer, and SvgSprite are reusable and theme-aligned.</p>
            </Section>

            <Section id="theming" title="Theming">
              <p>Modify <code>tailwind.config.ts</code> for colors, shadows, fonts. See <code>src/styles.css</code> for utilities like <code>.aeg-card</code> and <code>.glass</code>.</p>
            </Section>

            <Section id="routing" title="Routing & Pages">
              <p>Routes are defined in <code>src/main.tsx</code> using React Router. Add new pages in <code>src/pages</code> and register them in the router.</p>
            </Section>

            <Section id="deploy" title="Build & Deploy">
              <p>Build with <code>pnpm build</code>. Deploy <code>dist/</code> to Vercel, Netlify, or Cloudflare Pages.</p>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Docs
