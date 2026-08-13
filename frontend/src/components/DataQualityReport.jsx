export default function DataQualityReport({ report, labels }) {
  if (!report) return null

  const missingEntries = Object.entries(report.missing_values || {})
  const outlierEntries = Object.entries(report.outliers || {})
  const duplicateEntityEntries = Object.entries(report.duplicate_entities || {})
  const hasIssues = missingEntries.length > 0 || report.duplicate_rows > 0 || outlierEntries.length > 0 || duplicateEntityEntries.length > 0

  const label = (col) => labels?.[col] || col

  if (!hasIssues) {
    return (
      <details className="bg-surface border border-rule rounded-lg shadow-sm p-4">
        <summary className="text-xs uppercase tracking-wide text-ink/50 font-body cursor-pointer select-none">
          Data quality
        </summary>
        <div className="text-sm font-body text-ink/70 mt-3">
          No missing values, duplicate rows, or statistical outliers found. Your file looks clean.
        </div>
      </details>
    )
  }

  return (
    <details className="bg-surface border border-rule rounded-lg shadow-sm p-4" open>
      <summary className="text-xs uppercase tracking-wide text-ink/50 font-body cursor-pointer select-none">
        Data quality
      </summary>

      <div className="mt-3 space-y-4">
        {report.duplicate_rows > 0 && (
          <div className="text-sm font-body text-ink/80">
            <span className="text-stamp font-medium">{report.duplicate_rows.toLocaleString()}</span> exact duplicate rows found out of {report.n_rows.toLocaleString()} total.
          </div>
        )}

        {duplicateEntityEntries.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-ink/40 font-body mb-1.5">Possible duplicate entities</div>
            <ul className="text-sm font-body text-ink/70 space-y-1">
              {duplicateEntityEntries.map(([col, info]) => (
                <li key={col}>
                  <span className="font-mono text-xs text-ink/50">{label(col)}</span>: {info.n_repeated_values.toLocaleString()} values appear multiple times with different data ({info.n_affected_rows.toLocaleString()} rows total)
                  {info.examples?.length > 0 && (
                    <span className="text-ink/40"> (e.g. "{info.examples[0].value}" appears {info.examples[0].count} times)</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="text-xs text-ink/40 font-body mt-1.5">
              These aren't exact duplicate rows (something differs between them), but the same name repeating with different data usually means the same real-world record was captured more than once. Totals computed from this data may be inflated as a result.
            </div>
          </div>
        )}

        {missingEntries.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-ink/40 font-body mb-1.5">Missing values</div>
            <ul className="text-sm font-body text-ink/70 space-y-1">
              {missingEntries.map(([col, info]) => (
                <li key={col}>
                  <span className="font-mono text-xs text-ink/50">{label(col)}</span>: {info.count.toLocaleString()} missing ({info.pct}%)
                </li>
              ))}
            </ul>
          </div>
        )}

        {outlierEntries.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-ink/40 font-body mb-1.5">Statistical outliers</div>
            <ul className="text-sm font-body text-ink/70 space-y-1">
              {outlierEntries.map(([col, info]) => (
                <li key={col}>
                  <span className="font-mono text-xs text-ink/50">{label(col)}</span>: {info.count.toLocaleString()} values ({info.pct}%) fall outside the typical range
                  {info.examples?.length > 0 && (
                    <span className="text-ink/40"> (examples: {info.examples.join(', ')})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-ink/40 font-body">
          Outliers are flagged using a standard statistical method (values far outside the typical range for that column), not manually reviewed. Some flagged values may be genuine, not errors.
        </div>
      </div>
    </details>
  )
}
