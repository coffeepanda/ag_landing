import React from "react"
import { CHANGELOG, type Release } from "../data/changelog"

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
    {children}
  </span>
)

const ReleaseCard: React.FC<{ rel: Release }> = ({ rel }) => (
  <article className="rounded-xl border border-slate-200 bg-white/70 p-4 shadow-soft">
    <div className="flex items-center justify-between gap-2">
      <div className="text-base font-semibold text-slate-900">
        {rel.version}
      </div>
      <div className="flex items-center gap-2 text-sm">
        {rel.tag && <Badge>{rel.tag}</Badge>}
        <div className="text-slate-500">{rel.date}</div>
      </div>
    </div>

    <div className="mt-3 space-y-4">
      {rel.changes.map((chg, i) => (
        <section key={i}>
          <h4 className="text-sm font-medium text-slate-800">{chg.title}</h4>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
            {chg.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
          {chg.link && (
            <a
              href={chg.link}
              className="mt-2 inline-block text-sm text-brand hover:underline"
              target="_blank"
              rel="noopener"
            >
              Learn more →
            </a>
          )}
        </section>
      ))}
    </div>
  </article>
)

const Empty: React.FC = () => (
  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
    No entries yet. Check back soon.
  </div>
)

const Changelog: React.FC = () => {
  const items = CHANGELOG
  return (
    <section className="mx-auto px-6 container-max py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Changelog</h1>
      <p className="mt-2 text-slate-600 text-sm">
        Open core in development — this page lists visible changes before GitHub Releases go live.
      </p>

      <div className="mt-6 grid gap-4">
        {items.length ? items.map((rel, idx) => <ReleaseCard key={idx} rel={rel} />) : <Empty />}
      </div>

      <div className="mt-8 text-xs text-slate-500">
        Tip: When the repo is public, redirect this page to GitHub Releases, or mirror entries automatically.
      </div>
    </section>
  )
}

export default Changelog
