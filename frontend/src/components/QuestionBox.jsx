import { useState } from 'react'
import { executeQuerySpec } from '../lib/chartCompute'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

function formatNumber(n) {
  if (n === null || n === undefined) return '--'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function describeSpec(spec, labels) {
  const label = (col) => labels?.[col] || col
  const opWord = { average: 'average', sum: 'total', count: 'count', min: 'minimum', max: 'maximum' }[spec.operation]
  let text = spec.target_column ? `${opWord} of ${label(spec.target_column)}` : opWord
  if (spec.return_columns?.length > 0 && spec.target_column && !spec.group_by) {
    text = `${label(spec.return_columns[0])} at ${opWord} ${label(spec.target_column)}`
  }
  if (spec.group_by) text += ` by ${label(spec.group_by)}`
  if (spec.filters?.length > 0) {
    text += ' where ' + spec.filters.map(f => `${label(f.column)} ${f.operator} ${f.value}`).join(' and ')
  }
  return text
}

export default function QuestionBox({ rows, columnTypes, labels }) {
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('idle')
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)

  async function handleAsk() {
    if (!question.trim() || status === 'loading') return
    setStatus('loading')
    setError(null)
    setAnswer(null)

    try {
      const resp = await fetch(`${API_BASE}/api/ask-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, column_types: columnTypes, labels }),
      })
      const spec = await resp.json()

      if (spec.error) {
        setError(spec.error)
        setStatus('error')
        return
      }
      if (spec.clarification_needed) {
        setError(spec.clarification_needed)
        setStatus('error')
        return
      }

      const result = executeQuerySpec(rows, spec)
      setAnswer({ spec, result })
      setStatus('done')
    } catch (e) {
      setError('Could not reach the server. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="bg-surface border-2 border-ledger/40 rounded-lg shadow-sm p-6 glow-ring relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-ledger/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-ledger">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-1.5 2-2.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
        </svg>
        <div className="text-sm uppercase tracking-wide text-ledger font-body font-semibold">Ask a question</div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask anything about your data"
          className="flex-1 border border-rule rounded-md px-3 py-2 text-sm font-body bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
        />
        <button
          onClick={handleAsk}
          disabled={status === 'loading'}
          className="bg-ledger hover:bg-ledger-dark transition-colors text-white text-sm font-body font-medium px-4 py-2 rounded-md disabled:opacity-50"
        >
          {status === 'loading' ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {status === 'error' && (
        <div className="text-sm font-body text-stamp mt-3">{error}</div>
      )}

      {status === 'done' && answer && (
        <div className="mt-4 pt-4 border-t border-rule/60">
          <div className="text-xs font-mono text-ink/40 mb-2">{describeSpec(answer.spec, labels)}</div>

          {answer.result.type === 'single' && (
            <div className="text-2xl font-display font-semibold text-ledger">
              {formatNumber(answer.result.result)}
            </div>
          )}

          {answer.result.type === 'grouped' && (
            <div className="space-y-1">
              {answer.result.results.map((r, i) => (
                <div key={i} className="flex justify-between text-sm font-body">
                  <span className="text-ink/70">{r.group}</span>
                  <span className="font-mono text-ink">{formatNumber(r.value)} <span className="text-ink/40">(n={r.n})</span></span>
                </div>
              ))}
            </div>
          )}

          {answer.result.type === 'lookup' && (
            <div className="space-y-2">
              {answer.result.rows.length === 0 ? (
                <div className="text-sm font-body text-ink/50">No matching rows found.</div>
              ) : (
                answer.result.rows.map((row, i) => (
                  <div key={i} className="bg-paper border border-rule rounded-md p-3">
                    {Object.entries(row).map(([col, val]) => (
                      <div key={col} className="flex justify-between text-sm font-body">
                        <span className="text-ink/60">{labels?.[col] || col}</span>
                        <span className="font-mono text-ink font-medium">{typeof val === 'number' ? formatNumber(val) : val}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
              {answer.result.truncated && (
                <div className="text-xs text-ink/40 font-body">
                  Showing 5 of {answer.result.totalMatching} tied results.
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-ink/40 font-body mt-2">
            Based on {answer.result.matchedRows.toLocaleString()} matching rows.
          </div>
        </div>
      )}
    </div>
  )
}
