import React from "react"

const TrafficLights = () => (
  <div className="flex items-center gap-1.5">
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400/80" />
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-300/90" />
    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400/90" />
  </div>
)

const Bubble: React.FC<
  React.PropsWithChildren<{ who: "you" | "helper"; meta?: string }>
> = ({ who, meta, children }) => {
  const isYou = who === "you"
  return (
    <div className={`flex items-start gap-3 ${isYou ? "justify-end" : ""}`}>
      {!isYou && (
        <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-brand/20 ring-1 ring-brand/40" />
      )}
      <div
        className={[
          "max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-6 shadow-soft border",
          isYou
            ? "bg-slate-800/80 text-slate-100 border-slate-700 ml-8"
            : "bg-white/90 text-slate-800 border-slate-200",
        ].join(" ")}
      >
        {children}
        {meta && (
          <div
            className={`mt-1 text-[11px] ${
              isYou ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {meta}
          </div>
        )}
      </div>
      {isYou && (
        <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-accent/30 ring-1 ring-accent/40" />
      )}
    </div>
  )
}

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="w-full mt-2">
    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
    <div className="text-[11px] text-slate-500 mt-1">{value}%</div>
  </div>
)

const ArtifactChip: React.FC<{ id: string }> = ({ id }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
    <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
    {id}
  </span>
)

const ActionRow: React.FC<{
  onApprove?: () => void
  onEdit?: () => void
}> = ({ onApprove, onEdit }) => (
  <div className="flex items-center gap-2 mt-2">
    <button
      onClick={onApprove}
      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium shadow-soft hover:opacity-95"
    >
      Approve
    </button>
    <button
      onClick={onEdit}
      className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700"
    >
      Edit
    </button>
  </div>
)

/** Polished chat preview matching the site’s glass + token styles */
const ChatPreview: React.FC = () => {
  return (
    <div className="aeg-card p-0 overflow-hidden">
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
<span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] border border-amber-200">
 AetherGraph Agent
</span>
          </div>
        </div>
        <span className="text-[11px] text-slate-500">live preview</span>
      </div>

      {/* Transcript */}
      <div className="bg-slate-50/60 p-4 md:p-5 space-y-3">
        <Bubble who="you" meta="now">
          <span className="font-semibold text-brand">You:</span>{" "}
          plot MTF50 from latest run
        </Bubble>

        <Bubble who="helper" meta="draft plan · 2 steps">
          <div className="text-slate-800">
            <span className="font-semibold text-emerald-700">Helper:</span>{" "}
            proposed code → run?
          </div>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-[12px] font-mono text-slate-800">
            load results → compute MTF50 → plot()
          </div>
          <ActionRow />
        </Bubble>

        {/* <Bubble who="helper" meta="executing · job: mtf50-plot-2025-10-20">
          <div className="text-slate-800">running…</div>
          <ProgressBar value={50} />
        </Bubble> */}

        <Bubble who="helper" meta="completed · 3s">
          <div className="text-slate-800">
            artifact saved: <ArtifactChip id="mtf50_plot@2025-10-20" />
          </div>
          <div className="mt-2 text-slate-700 text-sm">
            summary (draft): cites <span className="font-medium">artifact#mtf50_plot@2025-10-20</span>
          </div>
        </Bubble>
      </div>
      <div className="px-4 pb-4 md:px-5">
    <p className="mt-2 text-[11px] text-slate-500">
      This is a <strong>mock UI</strong> illustrating an integration. AetherGraph provides the
      backend framework (channels, artifacts, memory, approvals). You bring Slack/CLI/web UI.
    </p>
  </div>
    </div>
  )
}

export default ChatPreview
