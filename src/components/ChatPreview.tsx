import React from "react"

const TrafficLights = () => (
  <div className="flex items-center gap-1.5">
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400/80" />
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-300/90" />
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400/90" />
  </div>
)

// 1) Replace your Bubble with this compact version
const Bubble: React.FC<
  React.PropsWithChildren<{ who: "you" | "Aether"; meta?: string }>
> = ({ who, meta, children }) => {
  const isYou = who === "you"
  return (
    <div className={`flex items-end ${isYou ? "justify-end" : ""}`}>
      {!isYou && (
        <div className="mr-1.5 mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand/20 ring-1 ring-brand/30" />
      )}

      <div
        className={[
          // tighter bubble: less padding, smaller font, tighter line-height
          "max-w-[92%] rounded-xl px-3 py-1.5 text-[13px] leading-5 shadow-soft border break-words",
          isYou
            ? "bg-slate-800/90 text-slate-100 border-slate-700"
            : "bg-white/95 text-slate-800 border-slate-200",
        ].join(" ")}
      >
        <span className={isYou ? "font-medium text-brand-50" : "font-medium text-brand"}>
          {isYou ? "You: " : "Aether: "}
        </span>
        <span className="align-middle">{children}</span>

        {/* meta inline and tiny */}
        {meta && (
          <span className={`ml-2 align-middle text-[10px] ${isYou ? "text-slate-400" : "text-slate-500"}`}>
            • {meta}
          </span>
        )}
      </div>

      {isYou && (
        <div className="ml-1.5 mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-accent/30 ring-1 ring-accent/40" />
      )}
    </div>
  )
}


const ArtifactChip: React.FC<{ id: string }> = ({ id }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
    <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
    {id}
  </span>
)

/** Polished chat preview matching the site’s glass + token styles */
const ChatPreview: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`aeg-card p-0 overflow-hidden relative h-full flex flex-col ${className ?? ''}`}>
      {/* Watermark */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="select-none rotate-[-18deg] text-slate-400/10 text-5xl font-extrabold tracking-widest">
          MOCK UI
        </div>
      </div>

      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/70 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <TrafficLights />
          <div className="text-xs text-slate-600">
            <span className="px-2 py-0.5 rounded-md bg-white/100 text-slate-900 text-[11px] border border-slate-200">
              AetherGraph Agent
            </span>
          </div>
        </div>
      </div>

      {/* Transcript (scrolls) */}
      <div className="bg-slate-50/60 p-4 md:p-5 space-y-3 flex-1 overflow-auto">
        {/* Agent prompts for keyword (ask_text) */}
        <Bubble who="Aether" meta="awaiting input">
          <div className="text-slate-800">
            What filename keyword should I search for?
          </div>
        </Bubble>

        {/* User replies with a keyword */}
        <Bubble who="you" meta="2s ago">
          report
        </Bubble>

        {/* Agent lists matches (send_text with results) */}
        <Bubble who="Aether" meta="completed · 1s">
          <div className="text-slate-800 mb-1">
            🔎 Matches for <span className="font-mono text-slate-700">"report"</span>:
          </div>
                </Bubble>

        <Bubble who="Aether">

          {/* A compact listing; you can swap these for real URIs at runtime */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ArtifactChip id="artifacts/report_2025_10_30.csv" />
              <span className="text-[11px] text-slate-500">→ cas://a1b2c3…</span>
            </div>
            <div className="flex items-center gap-2">
              <ArtifactChip id="artifacts/report_summary.png" />
              <span className="text-[11px] text-slate-500">→ cas://d4e5f6…</span>
            </div>
            <div className="flex items-center gap-2">
              <ArtifactChip id="artifacts/monthly_report.md" />
              <span className="text-[11px] text-slate-500">→ cas://9a8b7c…</span>
            </div>
          </div>

          {/* Optional note for overflow */}
          <div className="mt-2 text-[11px] text-slate-500">
            (showing 3 of 8)
          </div>
        </Bubble>
      </div>

      {/* Footnote (non-scrolling) */}
      <div className="px-4 pb-4 md:px-5">
        <p className="mt-2 text-[11px] text-slate-500">
          This is a <strong>mock UI</strong> illustrating an integration. AetherGraph provides the
          backend framework. You bring Slack/CLI/web UI.
        </p>
      </div>
    </div>
  )
}

export default ChatPreview
