import { useState } from 'react'

const TYPE_OPTIONS = [
  { value: 'numeric_measure', label: 'Number' },
  { value: 'date', label: 'Date / Time' },
  { value: 'categorical', label: 'Category' },
  { value: 'identifier', label: 'ID / code' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'free_text', label: 'Free text' },
]
export default function ColumnCorrector({ columnTypes, columnAggKinds, columnConfidence, labels, userCorrectedColumns, correctionNotes, onApply }) {
  const [pending, setPending] = useState({}) // {col: {type, agg_kind}}
  const [applying, setApplying] = useState(false)

  const columns = Object.keys(columnTypes)
  const hasPending = Object.keys(pending).length > 0

  function confidenceOf(col) {
    return columnConfidence?.[col]?.type_confidence ?? 1.0
  }
  // Three tiers, matching a real production-readiness review: >0.90 needs
  // no attention, 0.70-0.90 is worth a glance, <0.70 is worth a real look
  // via the correction controls right here.
  function confidenceTier(col) {
    const c = confidenceOf(col)
    if (c >= 0.9) return 'high'
    if (c >= 0.7) return 'medium'
    return 'low'
  }

  const hasLowConfidence = columns.some(col => confidenceTier(col) === 'low')
  // Low-confidence columns first, so they're not buried below dozens of
  // confident ones -- the whole point of flagging them is to be seen.
  const sortedColumns = [...columns].sort((a, b) => confidenceOf(a) - confidenceOf(b))

  function currentType(col) {
    return pending[col]?.type ?? columnTypes[col]
  }
  function currentAggKind(col) {
    return pending[col]?.agg_kind ?? columnAggKinds?.[col] ?? 'sum'
  }

  function setType(col, type) {
    setPending(p => ({ ...p, [col]: { type, agg_kind: type === 'numeric_measure' ? currentAggKind(col) : undefined } }))
  }
  function setAggKind(col, agg_kind) {
    setPending(p => ({ ...p, [col]: { type: currentType(col), agg_kind } }))
  }

  async function handleApply() {
    setApplying(true)
    try {
      await onApply(pending)
      setPending({})
    } finally {
      setApplying(false)
    }
  }

  return (
    <details className="bg-surface border border-rule rounded-lg shadow-sm p-4" open={hasPending || hasLowConfidence}>
      <summary className="text-xs uppercase tracking-wide text-ink/50 font-body cursor-pointer select-none flex items-center gap-2">
        How we read your columns
        {hasLowConfidence && (
          <span className="bg-stamp text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium normal-case">
            some columns need a look
          </span>
        )}
      </summary>

      <div className="text-xs text-ink/40 font-body mt-2 mb-3">
        These types come directly from your data, not guesses from column names. If something looks wrong,
        for example a column that should be averaged but shows as a total, change it below and apply the fix.
        Columns marked "not sure" were a genuinely close statistical call, worth double-checking.
      </div>

      <table className="w-full text-sm font-body">
        <thead>
          <tr className="text-left text-ink/50 border-b border-rule">
            <th className="pb-1 font-normal">Column</th>
            <th className="pb-1 font-normal">Type</th>
            <th className="pb-1 font-normal">Aggregation</th>
            <th className="pb-1 font-normal">Confidence</th>
            <th className="pb-1 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {sortedColumns.map(col => {
            const type = currentType(col)
            const isChanged = !!pending[col]
            const wasCorrected = userCorrectedColumns?.includes(col)
            const tier = confidenceTier(col)
            return (
              <tr key={col} className="border-b border-rule/50">
                <td className="py-1.5 font-mono text-xs">{labels?.[col] || col}</td>
                <td className="py-1.5">
                  <select
                    value={type}
                    onChange={(e) => setType(col, e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="bg-paper border border-rule rounded-md px-1.5 py-0.5 text-xs text-ink"
                  >
                    {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="py-1.5">
                  {type === 'numeric_measure' ? (
                    <select
                      value={currentAggKind(col)}
                      onChange={(e) => setAggKind(col, e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="bg-paper border border-rule rounded-md px-1.5 py-0.5 text-xs text-ink"
                    >
                      <option value="sum">Total</option>
                      <option value="average">Average</option>
                    </select>
                  ) : (
                    <span className="text-ink/30 text-xs">-</span>
                  )}
                </td>
                <td className="py-1.5">
                  {tier === 'low' && !wasCorrected && (
                    <span className="text-xs text-stamp font-medium">not sure, please check</span>
                  )}
                  {tier === 'medium' && !wasCorrected && (
                    <span className="text-xs text-ink/50">probably right</span>
                  )}
                  {tier === 'high' && !wasCorrected && (
                    <span className="text-xs text-ink/30">confident</span>
                  )}
                  {wasCorrected && <span className="text-xs text-ledger">manually set</span>}
                </td>
                <td className="py-1.5">
                  {isChanged && <span className="text-xs text-stamp font-medium">changed</span>}
                  {!isChanged && wasCorrected && <span className="text-xs text-ledger font-medium">corrected</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {correctionNotes && Object.keys(correctionNotes).length > 0 && (
        <div className="mt-3 space-y-1">
          {Object.entries(correctionNotes).map(([col, note]) => (
            <div key={col} className="text-xs font-body text-stamp">{note}</div>
          ))}
        </div>
      )}

      {hasPending && (
        <button
          onClick={handleApply}
          disabled={applying}
          className="mt-4 bg-ledger hover:bg-ledger-dark transition-colors text-white text-sm font-body font-medium px-4 py-2 rounded-md disabled:opacity-50"
        >
          {applying ? 'Applying...' : `Apply ${Object.keys(pending).length} correction${Object.keys(pending).length !== 1 ? 's' : ''}`}
        </button>
      )}
    </details>
  )
}
