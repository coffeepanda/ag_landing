
import React from 'react'

const Card: React.FC<React.PropsWithChildren<{ title: string; icon: string }>> = ({ title, icon, children }) => (
  <div className="aeg-card p-6 h-full">
    <div className="flex items-center gap-3">
      <svg className="icon-2d text-slate-700"><use href={icon} /></svg>
      <h3 className="text-xl font-semibold">{title}</h3>
    </div>
    <div className="text-slate-700 mt-3 text-base">{children}</div>
  </div>
)

export const Examples: React.FC = () => (
  <section id="examples" className="py-24 border-t border-slate-200/60 bg-grid bg-white">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">See it in action</h2>
      <p className="text-slate-700 mt-3 text-lg max-w-3xl">
        Real tasks researchers and engineers do every day—now interactive, auditable, and easy to share with AI.
        Save artifacts explicitly for versioning and traceability.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <Card title="Interactive analysis" icon="#icon-analysis">
          Ask a question → helper proposes code → run → get a chart.
          Save code and outputs as artifacts for a clean, versioned trail.
        </Card>

        <Card title="Monitor long jobs" icon="#icon-timer">
          Kick off simulation/optimization/training; get notified on completion or failure;
          tweak parameters with approvals; resume after interruptions.
        </Card>

        <Card title="Summarize with memory" icon="#icon-report">
          Generate <span className="font-medium">draft summaries</span> grounded in artifacts and RAG.
          Every claim is traceable with clear IDs and provenance.
        </Card>

        {/* b) Build your own copilot */}
        <Card title="Build your own copilot" icon="#icon-bot">
          Compose tools, approvals, memory, and channels to create a domain-specific copilot—yours,
          not a black box. Start simple, grow as needed.
        </Card>

        {/* c) More examples… */}
        <Card title="More examples" icon="#icon-sparkles">
          More examples, use cases, and code patterns will be released soon...
        </Card>
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
          <li><span className="font-semibold">One decorator</span> turns a Python function into an interactive agent with memory.</li>
          <li><span className="font-semibold">Run inside your program</span> with minimal changes—keep your current flow.</li>
          <li><span className="font-semibold">Bring your own tools & services</span> — plug in libraries/APIs via Python; no rewrites.</li>

        </ul>
        <p className="text-slate-500 mt-4 text-sm">We integrate with your infra, not the other way around.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="aeg-card p-6">
          <div className="flex items-center gap-2">
            <svg className="icon-2d text-slate-700"><use href="#icon-lab" /></svg>
            <div className="font-semibold">Fits when…</div>
          </div>
          <ul className="mt-3 list-disc ml-5 text-slate-800 text-base space-y-1">
            <li>You need interactive, resumable runs with provenance.</li>
            <li>You save artifacts + memory for summaries and audits.</li>
            <li>You want channel UX (Slack/CLI) for long jobs & approvals.</li>
          </ul>
        </div>

        <div className="aeg-card p-6">
          <div className="flex items-center gap-2">
            <svg className="icon-2d text-slate-700"><use href="#icon-shield" /></svg>
            <div className="font-semibold">Not a fit if…</div>
          </div>
          <ul className="mt-3 list-disc ml-5 text-slate-800 text-base space-y-1">
            <li>You want a black-box “AI that does research for you.”</li>
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
          ['Right now', 'Chat with a plotting/eval function; save outputs you care about as artifacts.'],
          ['This week', 'Wrap your sim/train loop; add approvals and checkpoints without changing the rest.'],
          ['This month', 'Artifact‑aware summaries and comparisons for team sharing and reproducibility.'],
          ['When you’re ready', 'Design your own copilot: interactive design loops or automated agentic systems.'],
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
      <p className="text-slate-700 mt-3 text-lg max-w-3xl">
        The core is being released under an open license so researchers and engineers can trust, extend, and standardize around it.
        We’re committed to transparency and fostering a vibrant community.
      </p>


      <p className="text-slate-500 text-xs mt-3">
        Optimized for R&D today; production features are in development. Commercial support is available by agreement.
      </p>
    </div>
  </section>
)


export const Audience: React.FC = () => (
  <section className="py-24">
    <div className="mx-auto px-6 container-max">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Who gets value today</h2>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {[
          ['#icon-lab', 'Research & Labs', 'Reproduce results and generate artifact-cited reports with clear provenance.'],
          ['#icon-ml', 'Applied ML & Data', 'Audit data → train → evaluate with approvals and traceable experiment logs.'],
          ['#icon-sim', 'Simulation & Engineering', 'Run optimization/tolerance studies you can pause, inspect, tweak, and resume.'],
          ['#icon-bio', 'Bioinformatics & Health', 'Build review-ready analyses with auditable steps and artifact-anchored summaries.'],
          ['#icon-robot', 'Robotics & Automation', 'Tune control loops interactively with human-in-the-loop approvals and safe rollback.'],
          ['#icon-fin', 'Quant & Operations', 'Backtest and deploy with provenance, guardrails, and policy-aware execution.'],
        ].map(([icon, tag, desc]) => (
          <div key={String(tag)} className="aeg-card p-5">
            <div className="flex items-center gap-2">
              <svg className="icon-2d text-slate-700"><use href={String(icon)} /></svg>
              <div className="text-slate-500 tag">{tag}</div>
            </div>
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
          [
            "Do I need LLMs?",
            "No—agents can be pure code. LLMs and AI features are optional when helpful.",
          ],
          [
            "Do I have to learn a new framework?",
            "No—start with a decorator; keep your program. Compose flows later if you want.",
          ],
          [
            "How do summaries avoid hallucinations?",
            "Summaries are drafts anchored to saved artifacts and memory; each claim traces to an artifact.",
          ],
          [
            "Is this an agent that automates everything?",
            "AetherGraph is a framework for agentic workflows. Use it as helper functions or automate when ready.",
          ],
          // New: clarify UI
          [
            "Do you ship a UI?",
            "Not initially—the chat preview is a mock. Slack and CLI integrations are supported with instructions. For custom UI integrations and deployments, please contact us."
          ],
          // New: hosting/runtime
          [
            "Where does it run?",
            "Anywhere Python runs—your laptop, servers, or cloud. Keep data where you want it.",
          ],
          // New: extensibility
          [
            "Can I bring my own services?",
            "Yes. Register custom services as context.* (LLM/RAG/tools/MCP/HTTP). Swap providers freely.",
          ],
          // New: privacy & data
          // [
          //   "What about privacy?",
          //   "Artifacts and logs stay in your environment. You decide what, if anything, leaves your network.",
          // ],
          // New: cost / licenses (adjust copy later if needed)
          [
            "Is there an open-source version?",
            "Yes. The AetherGraph core is open source under Apache-2.0. Docs and examples ship with the alpha."
          ],

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

