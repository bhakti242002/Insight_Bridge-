import { useState } from 'react'

const COLLAPSED_COUNT = 4

export default function InsightsPanel({ charts, excludeTitles = [] }) {
  const [expanded, setExpanded] = useState(false)

  const insights = charts
    .filter(c => c.summary?.stat_summary && !excludeTitles.includes(c.title))
    .map(c => ({ title: c.title, text: c.summary.ai_sentence || c.summary.stat_summary }))

  if (insights.length === 0) return null

  const visible = expanded ? insights : insights.slice(0, COLLAPSED_COUNT)
  const hiddenCount = insights.length - visible.length

  return (
    <div className="bg-surface-light border border-ledger/20 rounded-lg shadow-sm p-6">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-3">Key Insights</div>
      <ul className="space-y-2.5">
        {visible.map((ins, i) => (
          <li key={i} className="flex gap-2.5 text-sm font-body leading-relaxed text-ink/85">
            <span className="text-stamp flex-shrink-0 mt-1">•</span>
            <span>{ins.text}</span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="no-print text-xs font-body text-ledger hover:text-ledger-dark mt-3 underline"
        >
          Show {hiddenCount} more
        </button>
      )}
      {expanded && insights.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="no-print text-xs font-body text-ink/40 hover:text-ink/60 mt-3 ml-4 underline"
        >
          Show less
        </button>
      )}
    </div>
  )
}
