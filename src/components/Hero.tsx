
import React, { useState } from 'react'

const Hero: React.FC = () => {
  const [tab, setTab] = useState<'chat' | 'code'>('chat')
  const PY_SNIPPET = `# pseudo-code example
from aethergraph import graph_fun, channel, artifacts, memory

@graph_fun(name="analyze_csv")
def analyze_csv(path: str, column: str):
    df = load_csv(path)
    fig = plot_hist(df[column])
    art_id = artifacts.save(fig, name=f"hist_{column}")  # explicit save
    memory.note(f"Plotted {column} from {path}", artifact=art_id)
    return {"artifact_id": art_id, "message": "Chart ready"}

# run from a channel (Slack/CLI)
channel("slack").send("analyze_csv", path="data.csv", column="mtf50")`;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full bg-brand/10"></div>
        <div className="absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full bg-accent/10"></div>
      </div>
      <div className="mx-auto px-6 container-max py-20 md:py-28 relative">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand tag mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-brand"></span> Open core for real R&D
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Talk to your tools. <span className="text-brand">Keep your provenance.</span>
            </h1>
            <p className="text-slate-700 mt-5 text-lg">
              AetherGraph turns any Python function into an interactive, auditable workflow—chat through Slack/CLI,
              save artifacts for versioning and tracing, and resume anywhere.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a href="#waitlist" className="px-5 py-3 rounded-xl bg-accent text-white font-semibold shadow-soft">Join the waitlist</a>
              <a href="#examples" className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold shadow-soft">See example flows</a>
            </div>
            <p className="text-slate-500 mt-3 text-sm">Public alpha targeting <strong>mid‑November 2025</strong> (docs, demo, quickstart).</p>
          </div>
          <div className="md:pl-8">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setTab('chat')} className={`px-3 py-1 rounded-lg text-sm ${tab === 'chat' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Chat</button>
              <button onClick={() => setTab('code')} className={`px-3 py-1 rounded-lg text-sm ${tab === 'code' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Code</button>
            </div>
            <div className="glass rounded-2xl border border-white/60 shadow-soft p-5 md:p-6">
              {tab === 'chat' ? (
                <div className="bg-slate-900 rounded-xl p-4 text-white text-sm font-mono">
                  <div className="opacity-80">$ slack · #aether-lab</div>
                  <div className="mt-3 space-y-3">
                    <div><span className="text-brand">You</span>: plot MTF50 from latest run</div>
                    <div><span className="text-emerald-300">Helper</span>: proposed code ▶ run?</div>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded bg-emerald-500/20">Approve</button>
                      <button className="px-2 py-1 rounded bg-slate-700">Edit</button>
                    </div>
                    <div className="mt-3">progress ▓▓▓▓▓▓░░░░ 50%</div>
                    <div className="mt-3">artifact saved: <span className="text-brand">mtf50_plot@2025‑10‑20</span></div>
                    <div className="mt-2">summary (draft): cites <span className="text-slate-300">artifact#mtf50_plot@2025‑10‑20</span></div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-xl p-4 text-slate-100 text-sm font-mono overflow-auto">
                  <pre><code>{PY_SNIPPET}</code></pre>

                </div>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-2">Toggle between chat and code to see how it works.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
