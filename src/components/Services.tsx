import React from "react"

export const Services: React.FC = () => {
  const core = [
    { icon: '#icon-channel',  title: 'Channels',  desc: 'Slack / CLI messages, progress, approvals.' },
    { icon: '#icon-artifact', title: 'Artifacts', desc: 'Save charts/tables/logs for versioning & tracing.' },
    { icon: '#icon-memory',   title: 'Memory',    desc: 'Recall prior runs and context across agents.' },
    { icon: '#icon-logger',   title: 'Logger',    desc: 'Structured logs tied to steps and artifacts.' },
    { icon: '#icon-kv',       title: 'KV',        desc: 'Tiny key–value store for run state/config.' },
  ]

  const optional = [
    { icon: '#icon-robot',    title: 'LLM',       desc: 'Chat, generate, embed — swappable client.' },
    { icon: '#icon-analysis', title: 'RAG',       desc: 'Query your artifacts/docs to ground outputs.' },
    { icon: '#icon-plug',     title: 'MCP',       desc: 'Call external tools/services via MCP.' },
    // Extensibility card
    { icon: '#icon-sparkles', title: 'Bring your own', desc: 'Register custom services as context.*' },
  ]

  return (
    <section id="services" className="py-24">
      <div className="mx-auto px-6 container-max">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Core services — built in, not bolted on
        </h2>
        <p className="text-slate-700 mt-3 text-lg max-w-3xl">
          Primitives exposed as <span className="font-semibold">context methods</span> you can call from any AetherGraph agent.
          Shared, testable, and consistent across your workflows.
        </p>

        {/* Core primitives */}
        <div className="mt-10">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Core primitives</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 auto-rows-fr items-stretch">
            {core.map((i) => (
              <div key={i.title} className="aeg-card h-full min-h-[148px] p-5 flex flex-col">
                <div className="flex items-center gap-2 text-slate-800 mb-2">
                  <svg className="icon-2d text-slate-700"><use href={i.icon} /></svg>
                  <div className="font-medium">{i.title}</div>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{i.desc}</p>
              </div>
            ))}
          </div>
        </div>
          <p className="text-slate-500 text-xs mt-3">
            We also provide optional basic services such as <span className="font-mono">llm</span>, <span className="font-mono">rag</span>, and <span className="font-mono">mcp</span>. You can also bring your own services and integrate it with AetherGraph. All above are accessed as <code className="font-mono">context.*</code> methods across agents.
          </p>
      </div>
    </section>
  )
}

export default Services
