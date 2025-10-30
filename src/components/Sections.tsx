
import React from 'react'

const Card: React.FC<React.PropsWithChildren<{ title: string; icon: string }>> = ({ title, icon, children }) => (
  <div className="aeg-card p-6 h-full">
    <div className="flex items-center gap-3">
      <svg className="icon-2d text-slate-700"><use href={icon}/></svg>
      <h3 className="text-xl font-semibold">{title}</h3>
    </div>
    <div className="text-slate-700 mt-3 text-base">{children}</div>
  </div>
)

export const Examples: React.FC = () => (
  <section id="examples" className="py-24 border-t border-slate-200/60 bg-grid bg-white">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">See it in action</h2>
      <p className="text-slate-700 mt-3 text-lg max-w-3xl">Real tasks researchers do every day—now interactive, auditable, and easy to share. Save artifacts explicitly for versioning and tracing.</p>
      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <Card title="Interactive analysis" icon="#icon-analysis">Ask a question → a helper proposes code → run → get a chart. Save the code and outputs as artifacts when you want to keep a versioned trail.</Card>
        <Card title="Monitor long jobs" icon="#icon-timer">Kick off sims/opt/train; watch progress in Slack; tweak params with approvals; resume after failures.</Card>
        <Card title="Artifact‑anchored summaries (you approve)" icon="#icon-report">Generate <span className='font-medium'>draft summaries</span> grounded in the artifacts you saved and session memory. You review/edit/approve; every claim cites artifact IDs.</Card>
        <Card title="Governance, without friction" icon="#icon-shield">Lightweight policies for approvals, dataset logging, and provenance—when you need them.</Card>
      </div>
      <p className="text-slate-500 text-sm mt-6">AetherGraph is a framework: it <em>enables</em> artifact‑anchored reports and workflows; it doesn’t auto‑publish without you.</p>
    </div>
  </section>
)

export const Services: React.FC = () => (
  <section id="services" className="py-24">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Core services — built in, not bolted on</h2>
      <p className="text-slate-700 mt-3 text-lg max-w-3xl">Primitives that keep work grounded in evidence and easy to operate.</p>
      <div className="grid md:grid-cols-5 gap-4 mt-10 items-stretch">
        {[
          { icon: '#icon-channel', title: 'Channels', desc: 'Slack/CLI messages, progress, approvals.' },
          { icon: '#icon-artifact', title: 'Artifacts', desc: 'Save charts/tables/logs for versioning & tracing.' },
          { icon: '#icon-memory', title: 'Memory', desc: 'Remembers context and prior runs; helps the system “recall what happened.”' },
          { icon: '#icon-logger', title: 'Logger', desc: 'Structured logs tied to steps and artifacts.' },
          { icon: '#icon-kv', title: 'KV', desc: 'Tiny key‑value store for state/config.' },
        ].map((i) => (
          <div key={i.title} className="aeg-card h-full p-5 flex flex-col">
            <div className="flex items-center gap-2 text-slate-800 mb-2">
              <svg className="icon-2d"><use href={i.icon}/></svg>
              <div className="font-medium">{i.title}</div>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{i.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export const Flexibility: React.FC = () => (
  <section id="flex" className="py-24 border-t border-slate-200/60 bg-gradient-to-b from-slate-50 to-white">
    <div className="mx-auto px-6 container-max grid md:grid-cols-2 gap-12 items-start">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Flexibility, not rewrites</h2>
        <ul className="mt-5 space-y-3 text-slate-800 text-lg">
          <li><span className="font-semibold">One decorator</span> turns a Python function into an agent with memory.</li>
          <li><span className="font-semibold">Run inside your program</span> with minimal changes—keep your current flow.</li>
          <li><span className="font-semibold">Compose later</span>: add approvals, checkpoints, and multi‑step flows only when you need them.</li>
        </ul>
        <p className="text-slate-500 mt-4 text-sm">We integrate with your infra, not the other way around.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="aeg-card p-6">
          <div className="flex items-center gap-2"><svg className="icon-2d text-slate-700"><use href="#icon-lab"/></svg><div className="font-semibold">Fits when…</div></div>
          <ul className="mt-3 list-disc ml-5 text-slate-800 text-base space-y-1">
            <li>You need interactive, resumable runs with provenance.</li>
            <li>You save artifacts + memory for summaries and audits.</li>
            <li>You want channel UX (Slack/CLI) for long jobs & approvals.</li>
          </ul>
        </div>
        <div className="aeg-card p-6">
          <div className="flex items-center gap-2"><svg className="icon-2d text-slate-700"><use href="#icon-shield"/></svg><div className="font-semibold">Not a fit if…</div></div>
          <ul className="mt-3 list-disc ml-5 text-slate-800 text-base space-y-1">
            <li>You want a black‑box “AI that does research for you.”</li>
            <li>You’re forced to rewrite pipelines for a walled garden.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
)

export const Roadmap: React.FC = () => (
  <section className="py-24 bg-grid">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Start small → Grow your own system</h2>
      <p className="text-slate-700 mt-3 text-lg max-w-3xl">Researchers can use AetherGraph immediately for small, high‑leverage tasks—and evolve into a personal system if and when it makes sense.</p>
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        {[
          ('Right now', 'Chat with a plotting/eval function; save outputs you care about as artifacts.'),
          ('This week', 'Wrap your sim/train loop; add approvals and checkpoints without changing the rest.'),
          ('This month', 'Artifact‑aware summaries and comparisons for team sharing and reproducibility.'),
          ('When you’re ready', 'Design your own copilot: interactive design loops and policy‑guarded execution.'),
        ].map(([tag, desc]) => (
          <div key={String(tag)} className="aeg-card p-5">
            <div className="text-slate-500 tag">{tag}</div>
            <p className="mt-1 text-base">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export const OSS: React.FC = () => (
  <section className="py-24 border-t border-slate-200/60 bg-slate-50">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Open source first</h2>
      <p className="text-slate-700 mt-3 text-lg max-w-3xl">We’re releasing the core under an open license so you can trust it, extend it, and standardize around it. Any future paid add‑ons will be optional and won’t lock you in.</p>
    </div>
  </section>
)

export const Audience: React.FC = () => (
  <section className="py-24">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Who gets value today</h2>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {[
          ['#icon-lab','Research & Labs','Reproducible experiments and artifact‑cited reports.'],
          ['#icon-ml','Applied ML & Data','Dataset audits → train → eval with approvals and summaries.'],
          ['#icon-sim','Simulation & Engineering','Optimize/tolerance workflows you can pause, inspect, and resume.'],
          ['#icon-bio','Bioinformatics & Healthcare','Traceable pipelines for analysis; artifact‑aware summaries for reviews.'],
          ['#icon-robot','Robotics & Automation','Interactive tuning of control loops with approvals and rollback via artifacts.'],
          ['#icon-fin','Quant Finance & Ops','Backtests and reports with provenance; policy‑guarded execution for risk.'],
        ].map(([icon, tag, desc]) => (
          <div key={String(tag)} className="aeg-card p-5">
            <div className="flex items-center gap-2"><svg className="icon-2d text-slate-700"><use href={String(icon)}/></svg><div className="text-slate-500 tag">{tag}</div></div>
            <p className="mt-2 text-base">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export const FAQ: React.FC = () => (
  <section className="py-24 border-t border-slate-200/60">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">FAQ</h2>
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        {[
          ['Do I need LLMs?', 'No—agents can be pure code. LLMs are optional when helpful.'],
          ['Do I have to learn a new framework?', 'No—start with a decorator; keep your program. Compose flows later if you want.'],
          ['Do you host long jobs?', 'Heavy compute runs on your infra. We provide the runtime + services and integrate with your environment.'],
          ['How do summaries avoid hallucinations?', 'Summaries are drafts anchored to saved artifacts and memory; each claim cites artifact IDs and you approve before sharing.'],
          ['Is this an agent that automates everything?', 'No. AetherGraph is a framework for building interactive workflows and artifact‑anchored reports. It helps you automate the right parts while keeping humans in the loop.'],
        ].map(([q, a]) => (
          <div key={String(q)} className="rounded-2xl border border-slate-200 p-6 bg-white">
            <div className="font-medium text-lg">{q}</div>
            <p className="text-slate-700 mt-1 text-base">{a}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
)
