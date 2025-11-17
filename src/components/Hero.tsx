import React, { useState } from 'react'
import CodeBlock from './CodeBlock'
import ChatPreview from './ChatPreview'

const PY_SNIPPET = `
from aethergraph import graph_fn, NodeContext

@graph_fn(name="hello_world")
async def hello_world(*, context: NodeContext):
    # 1) Ask the user what to look for (artifact kind)
    kind = await context.channel().ask_text("What artifact kind should I search for?")
    if not kind:
        await context.channel().send_text("Cancelled.")
        return {"status": "cancelled"}

    # 2) Search artifacts by kind (backend supports kind indexing)
    arts = context.artifacts()
    results = await arts.search(kind=kind)

    # 3) Report back to the channel
    if not results:
        await context.channel().send_text("🔎 No artifacts found for that kind. Try another.")
        return {"status": "ok", "count": 0, "kind": kind}

    total = len(results)
    top = results[:8]
    lines = "\\n".join(f"- {a.uri}" for a in top)
    more = "" if total <= 8 else f"\\n…and {total - 8} more."

    await context.channel().send_text(f"🔎 Matches found: {total} (kind = {kind!r})")
    await context.channel().send_text(lines + more)

    return {"status": "ok", "count": total, "kind": kind}
`.trim()

const Hero: React.FC = () => {
  const [tab, setTab] = useState<'chat' | 'code'>('chat')

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
              <span className="inline-block w-2 h-2 rounded-full bg-brand"></span>
              Public alpha • Agentic workflows for real R&D
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Talk to your Python. <span className="text-brand">Keep your provenance.</span>
            </h1>

            <p className="text-slate-700 mt-5 text-lg">
              AetherGraph turns plain Python into interactive, auditable agents—chat via Slack/CLI, capture
              artifacts &amp; metrics, log events to memory, and drive AI-assisted workflows via built-in
              context methods.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-8">
              {/* Primary CTA: GitHub */}
              <a
                href="https://github.com/AIperture/aethergraph"
                className="px-5 py-3 rounded-xl bg-accent text-white font-semibold shadow-soft hover:opacity-90 transition"
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub
              </a>

              {/* Secondary: Docs */}
              <a
                href="https://aiperture.github.io/aethergraph-docs/"
                className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold shadow-soft hover:bg-slate-800 transition"
                target="_blank"
                rel="noreferrer"
              >
                Read the docs
              </a>

              {/* Tertiary: Examples section on the page */}
              <a
                href="#examples"
                className="px-5 py-3 rounded-xl bg-slate-100 text-slate-800 font-semibold shadow-soft hover:bg-slate-200 transition"
              >
                See example flow
              </a>
            </div>

            <p className="text-slate-500 mt-3 text-sm">
              Public alpha is live – <span className="font-medium">repo, docs, and examples</span> are available
              to explore today.
            </p>
          </div>

          <div className="md:pl-8">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setTab('chat')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  tab === 'chat' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Chat
              </button>
              <button
                onClick={() => setTab('code')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  tab === 'code' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Code
              </button>
            </div>

            {/* Consistent, fixed height; inner content scrolls */}
            <div className="glass rounded-2xl border border-white/60 shadow-soft p-4 sm:p-5 md:p-6">
              <div className="h-[360px] sm:h-[420px] md:h-[480px]">
                {tab === 'chat' ? (
                  <ChatPreview className="h-full" />
                ) : (
                  <CodeBlock code={PY_SNIPPET} language="python" title="hello_world.py" fullHeight />
                )}
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Toggle between chat and code sketch to see how it works.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
