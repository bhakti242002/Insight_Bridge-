function formatNumber(n) {
  if (n === null || n === undefined) return '--'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function pickPrimaryMetric(charts) {
  const summaryCards = charts.filter(c => c.type === 'summary_card')
  if (summaryCards.length === 0) return null

  const strong = summaryCards.find(c => /total|revenue/i.test(c.title))
  if (strong) return strong

  const sumCards = summaryCards.filter(c => c.agg_kind === 'sum')
  if (sumCards.length > 0) {
    return sumCards.reduce((a, b) => (b.sum > a.sum ? b : a))
  }

  // No sum-type measure exists (e.g. every measure is a rate or average,
  // like a dataset of test scores and percentages). Prefer whichever
  // measure has its own time trend chart, a signal it's tracked as a KPI
  // rather than a background factor. Fall back to whichever measure
  // appears in the most category breakdowns, a signal it's central to
  // the analysis, rather than an arbitrary "first column in the file".
  const lineMeasures = new Set(charts.filter(c => c.type === 'line').map(c => c.measure_column))
  const withTrend = summaryCards.find(c => lineMeasures.has(c.measure_column))
  if (withTrend) return withTrend

  const barCounts = {}
  charts.filter(c => c.type === 'bar' && c.measure_column).forEach(c => {
    barCounts[c.measure_column] = (barCounts[c.measure_column] || 0) + 1
  })
  const mostUsed = [...summaryCards]
    .filter(c => barCounts[c.measure_column])
    .sort((a, b) => (barCounts[b.measure_column] || 0) - (barCounts[a.measure_column] || 0))[0]
  if (mostUsed) return mostUsed

  return summaryCards[0]
}

export function findTrendForMetric(charts, measureColumn) {
  return charts.find(c => c.type === 'line' && c.measure_column === measureColumn)
}

export default function Hero({ metric, trendChart, isLive, liveStats }) {
  if (!metric) return null
  const stats = isLive ? liveStats : metric
  if (isLive && !stats) {
    return (
      <div className="bg-surface border border-rule rounded-lg shadow-sm p-8">
        <div className="text-xs uppercase tracking-wide text-ink/50 font-body">{metric.title}</div>
        <div className="text-sm text-ink/40 font-body mt-2">No matching rows for the current filters.</div>
      </div>
    )
  }

  const isAverage = stats.agg_kind === 'average'
  const headline = isAverage ? stats.mean : stats.sum
  const summary = trendChart?.summary
  const changePct = summary?.change_pct
  const direction = summary?.direction
  const insightText = summary?.ai_sentence || summary?.stat_summary

  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-ledger to-stamp" />
      <div className="p-8">
        <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-2">
          {isAverage ? 'Average ' : ''}{metric.title}{isLive && <span className="text-stamp ml-1">(filtered)</span>}
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className="text-5xl font-display font-bold text-ledger tracking-tight">{formatNumber(headline)}</div>
          {changePct !== null && changePct !== undefined && !isLive && (
            <div className={`text-lg font-body font-medium ${
              direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-stamp-dark' : 'text-ink/40'
            }`}>
              {direction === 'up' ? '▲' : direction === 'down' ? '▼' : 'flat'} {Math.abs(changePct).toFixed(0)}%
            </div>
          )}
        </div>
        {insightText && !isLive && (
          <div className="text-base font-body text-ink/70 mt-3 max-w-2xl">{insightText}</div>
        )}
      </div>
    </div>
  )
}
