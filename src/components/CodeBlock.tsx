import React from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

type Props = {
  code: string
  language?: "python" | "tsx" | "ts" | "bash" | "json" | string
  title?: string
  wrap?: boolean
  fullHeight?: boolean
  className?: string
}

const CodeBlock: React.FC<Props> = ({
  code,
  language = "python",
  title,
  wrap,
  fullHeight,
  className
}) => {
  const [copied, setCopied] = React.useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <div className={`rounded-xl overflow-hidden shadow-soft border border-slate-800/40 bg-slate-900 ${fullHeight ? 'h-full flex flex-col' : ''} ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-900/70">
        <div className="flex items-center gap-2 text-slate-300 text-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500/70" />
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400/70" />
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/70" />
          <span className="ml-3 font-medium">{title ?? language}</span>
        </div>
        <button
          onClick={onCopy}
          className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Content */}
      <div className={`min-h-0 ${fullHeight ? 'flex-1 overflow-auto' : ''}`}>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLongLines={!!wrap}
          customStyle={{
            margin: 0,
            background: "transparent",
            fontSize: "0.9rem",
            padding: "12px 16px",
            ...(fullHeight ? { height: '100%' } : {}),
          }}
          lineNumberStyle={{ color: "#64748b", marginRight: "16px" }}
        >
          {code.trimEnd()}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export default CodeBlock
