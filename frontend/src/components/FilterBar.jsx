export default function FilterBar({ dateColumn, dateBounds, dateRange, onDateRangeChange, categoryFilter, onClearCategoryFilter, onClearAll }) {
  const hasAny = (dateRange?.start || dateRange?.end || categoryFilter)

  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink/50 font-body">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-ledger">
            <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Filters
        </div>

        {dateColumn && (
          <div className="flex items-center gap-2 text-xs font-body text-ink/70">
            <span className="text-ink/50">{dateColumn}</span>
            <input
              type="date"
              value={dateRange?.start || ''}
              min={dateBounds?.min}
              max={dateBounds?.max}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
              style={{ colorScheme: 'dark' }}
              className="border border-rule rounded-md px-2 py-1 text-xs font-mono bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
            <span className="text-ink/40">→</span>
            <input
              type="date"
              value={dateRange?.end || ''}
              min={dateBounds?.min}
              max={dateBounds?.max}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
              style={{ colorScheme: 'dark' }}
              className="border border-rule rounded-md px-2 py-1 text-xs font-mono bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
        )}

        {categoryFilter && (
          <button
            onClick={onClearCategoryFilter}
            className="text-xs font-body bg-stamp hover:bg-stamp-dark transition-colors text-white pl-3 pr-2 py-1.5 rounded-full flex items-center gap-1.5"
          >
            {categoryFilter.column}: <span className="font-semibold">{categoryFilter.value}</span>
            <span className="text-white/80 font-bold ml-0.5">×</span>
          </button>
        )}

        {hasAny ? (
          <button onClick={onClearAll} className="text-xs font-body text-ink/50 hover:text-ink underline ml-auto">
            Clear all filters
          </button>
        ) : (
          <span className="text-xs font-body text-ink/40 ml-auto">
            {dateColumn ? 'Pick a date range, or click a bar below to drill down' : 'Click a bar below to drill down'}
          </span>
        )}
      </div>
    </div>
  )
}
