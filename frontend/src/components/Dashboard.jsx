import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, Cell, PieChart, Pie, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import ExploreSection from './ExploreSection'
import FilterBar from './FilterBar'
import InsightsPanel from './InsightsPanel'
import DatasetOverview from './DatasetOverview'
import DataQualityReport from './DataQualityReport'
import QuestionBox from './QuestionBox'
import ColumnCorrector from './ColumnCorrector'
import { filterRows, recomputeSummaryCard, recomputeLineChart, recomputeBarChart, recomputeHistogram } from '../lib/chartCompute'

function formatNumber(n) {
  if (n === null || n === undefined) return '--'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function ChartSummary({ summary }) {
  if (!summary || !summary.stat_summary) return null
  return (
    <div className="mt-3 pt-3 border-t border-rule/60">
      {summary.ai_sentence && (
        <div className="text-sm font-body text-ink mb-1">{summary.ai_sentence}</div>
      )}
      <div className="text-xs font-mono text-ink/40">{summary.stat_summary}</div>
    </div>
  )
}

function ChartWarning({ text }) {
  if (!text) return null
  return (
    <div className="mt-2 flex items-start gap-1.5 text-xs font-body text-stamp">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
        <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 10v4M12 17.5v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>{text}</span>
    </div>
  )
}

function SummaryCard({ chart, liveStats, isLive }) {
  const stats = isLive ? liveStats : chart
  if (isLive && !stats) {
    return (
      <div className="bg-surface border border-rule rounded-lg shadow-sm p-4">
        <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-1">{chart.title}</div>
        <div className="text-sm text-ink/40 font-body">No matching rows.</div>
      </div>
    )
  }
  const isAverage = stats.agg_kind === 'average'
  const headlineValue = isAverage ? stats.mean : stats.sum
  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-1">
        {isAverage ? 'Average ' : ''}{chart.title}{isLive && <span className="text-stamp ml-1">(filtered)</span>}
      </div>
      <div className="text-2xl font-display font-semibold text-ledger">{formatNumber(headlineValue)}</div>
      <div className="text-xs text-ink/40 font-body mt-1">
        {isAverage ? `Total ${formatNumber(stats.sum)}` : `Averages ${formatNumber(stats.mean)}`}, ranging from {formatNumber(stats.min)} to {formatNumber(stats.max)}
      </div>
      {!isLive && <ChartWarning text={chart.warning} />}
    </div>
  )
}

function LineChartCard({ chart, livePoints, isLive }) {
  const points = isLive ? livePoints : chart.points
  const data = (points || []).map(p => ({ period: p.period, value: p.value }))
  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-5">
      <div className="text-xs uppercase tracking-wide text-ink/75 font-body mb-2 font-medium">
        {chart.title}{isLive && <span className="text-stamp ml-1">(filtered)</span>}
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-ink/40 font-body py-8 text-center">No matching rows.</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232B3D" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }} />
            <YAxis
              domain={chart.zero_anchor === false ? ['auto', 'auto'] : [0, 'auto']}
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}
            />
            <Tooltip formatter={(v) => formatNumber(v)} contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
            <Line type="monotone" dataKey="value" stroke="#818CF8" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      {!isLive && <ChartSummary summary={chart.summary} />}
      {!isLive && <ChartWarning text={chart.warning} />}
    </div>
  )
}

function HistogramChartCard({ chart, liveHist, isLive }) {
  const bins = isLive ? liveHist?.bins : chart.bins
  const data = (bins || []).map(b => ({ bin: b.bin, count: b.count }))
  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-5">
      <div className="text-xs uppercase tracking-wide text-ink/75 font-body mb-2 font-medium">
        {chart.title}{isLive && <span className="text-stamp ml-1">(filtered)</span>}
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-ink/40 font-body py-8 text-center">No matching rows.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ bottom: 55 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232B3D" />
            <XAxis dataKey="bin" tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }} angle={-35} textAnchor="end" interval={0} height={65} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }} />
            <Tooltip formatter={(v) => formatNumber(v)} contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
            <Bar dataKey="count" fill="#818CF8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {!isLive && <ChartSummary summary={chart.summary} />}
      {!isLive && <ChartWarning text={chart.warning} />}
    </div>
  )
}

const PIE_PALETTE = ['#818CF8', '#FF6B52', '#34D399', '#FBBF24', '#60A5FA', '#F472B6', '#A78BFA', '#2DD4BF']

function PieChartCard({ chart }) {
  const data = chart.slices || []
  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-5">
      <div className="text-xs uppercase tracking-wide text-ink/75 font-body mb-2 font-medium">{chart.title}</div>
      {data.length === 0 ? (
        <div className="text-sm text-ink/40 font-body py-8 text-center">No data.</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <Pie
              data={data.map(s => ({ name: s.category, value: s.value }))}
              dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
              label={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}
            >
              {data.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatNumber(v)} contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Sans', color: '#E7EAF3' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
      <ChartSummary summary={chart.summary} />
    </div>
  )
}

function BarChartCard({ chart, liveBars, isLive, activeCategory, onBarClick }) {
  const bars = isLive ? liveBars : chart.bars
  const data = (bars || []).map(b => ({ category: b.category, value: b.value }))
  const clickable = !!chart.category_column

  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-5">
      <div className="text-xs uppercase tracking-wide text-ink/75 font-body mb-2 font-medium">
        {chart.title}{isLive && <span className="text-stamp ml-1">(filtered)</span>}
        {clickable && <span className="text-ink/30 ml-2 font-normal">(click a bar to filter)</span>}
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-ink/40 font-body py-8 text-center">No matching rows.</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232B3D" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={80}
              tickFormatter={(v) => (v.length > 16 ? v.slice(0, 14) + '…' : v)}
            />
            <YAxis
              domain={chart.zero_anchor === false ? ['auto', 'auto'] : [0, 'auto']}
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}
            />
            <Tooltip formatter={(v) => formatNumber(v)} labelFormatter={(v) => v} contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
            <Bar
              dataKey="value"
              radius={[3, 3, 0, 0]}
              cursor={clickable ? 'pointer' : 'default'}
              onClick={clickable ? (clickedBar) => onBarClick(chart.category_column, clickedBar.category) : undefined}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={activeCategory === entry.category ? '#FBBF24' : '#FF6B52'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {!isLive && <ChartSummary summary={chart.summary} />}
      {!isLive && <ChartWarning text={chart.warning} />}
    </div>
  )
}

export default function Dashboard({ result, onApplyCorrections }) {
  const {
    charts, n_rows, n_cols, truncated, max_rows, overview,
    column_types, column_agg_kinds, sample_rows, chartable_columns, labels,
    dataset_overview, data_quality, user_corrected_columns, correction_notes, column_confidence,
  } = result

  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [categoryFilter, setCategoryFilter] = useState(null)

  // Corrections resubmit the same file and produce a NEW analysis (new
  // upload_id) without remounting this component. If a filter was
  // pointing at "Region" as a category and the correction changes what
  // "Region" even is, a stale filter could silently reference something
  // that no longer makes sense. Reset on every new analysis to avoid that.
  useEffect(() => {
    setDateRange({ start: '', end: '' })
    setCategoryFilter(null)
  }, [result.upload_id])

  const dateColumn = useMemo(
    () => Object.keys(chartable_columns || {}).find(c => chartable_columns[c] === 'date'),
    [chartable_columns]
  )

  const isLive = !!(dateRange.start || dateRange.end || categoryFilter)

  const filteredRows = useMemo(() => {
    if (!sample_rows) return []
    if (!isLive) return sample_rows
    return filterRows(sample_rows, { dateColumn, dateRange, categoryFilter })
  }, [sample_rows, dateColumn, dateRange, categoryFilter, isLive])

  function handleBarClick(column, value) {
    if (categoryFilter && categoryFilter.column === column && categoryFilter.value === value) {
      setCategoryFilter(null)
    } else {
      setCategoryFilter({ column, value })
    }
  }

  function clearAll() {
    setDateRange({ start: '', end: '' })
    setCategoryFilter(null)
  }

  const lineCharts = charts.filter(c => c.type === 'line')
  const barCharts = charts.filter(c => c.type === 'bar')
  const histogramCharts = charts.filter(c => c.type === 'histogram')
  const pieCharts = charts.filter(c => c.type === 'pie')
  const secondarySummaryCards = charts.filter(c => c.type === 'summary_card')

  return (
    <div className="space-y-5">
      {truncated && (
        <div className="bg-stamp/10 border border-stamp/40 text-ink text-sm rounded-lg p-3 font-body">
          Your file had more than {max_rows.toLocaleString()} rows. We analyzed the first {max_rows.toLocaleString()} to keep things fast.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-ink/50 font-body">
          Read {n_rows.toLocaleString()} rows across {n_cols} columns
          {overview.date_range && ` · ${overview.date_range.min} to ${overview.date_range.max}`}
        </div>
        <button
          onClick={() => window.print()}
          className="no-print text-xs font-body font-medium bg-surface border border-rule hover:border-ledger text-ink/70 px-3 py-1.5 rounded-md flex items-center gap-1.5"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export as PDF
        </button>
      </div>

      <DatasetOverview text={dataset_overview} />

      <InsightsPanel charts={charts} />

      {sample_rows && sample_rows.length > 0 && (
        <QuestionBox rows={filteredRows} columnTypes={column_types} labels={labels} />
      )}

      {(dateColumn || charts.some(c => c.category_column)) && sample_rows?.length > 0 && (
        <>
          <FilterBar
            dateColumn={dateColumn}
            dateBounds={overview.date_range}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onClearAll={clearAll}
          />
          {isLive && sample_rows.length < n_rows && (
            <div className="text-xs text-ink/40 font-body -mt-1">
              Filtered results are computed from {sample_rows.length.toLocaleString()} of {n_rows.toLocaleString()} rows and may differ slightly from the unfiltered totals above, which use the full file.
            </div>
          )}
        </>
      )}

      {charts.length === 0 && (
        <div className="bg-surface border border-rule rounded-lg shadow-sm p-6 text-center">
          <div className="font-display text-ink mb-1">Not enough structure to chart yet</div>
          <div className="text-sm text-ink/60 font-body">
            We didn't find any numeric or date columns to build charts from. Try a file with at least one number column (like a total, count, or score).
          </div>
        </div>
      )}

      {lineCharts.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-ink/40 font-body">Trends</div>
          <div className="grid grid-cols-1 gap-4">
            {lineCharts.map((chart, i) => {
              const livePoints = isLive
                ? recomputeLineChart(filteredRows, chart.date_column, chart.measure_column, column_agg_kinds?.[chart.measure_column] || 'sum', chart.grouping)
                : null
              return <LineChartCard key={i} chart={chart} livePoints={livePoints} isLive={isLive} />
            })}
          </div>
        </div>
      )}

      {barCharts.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-ink/40 font-body">Breakdowns</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {barCharts.map((chart, i) => {
              const liveBars = isLive
                ? recomputeBarChart(filteredRows, chart.category_column, chart.measure_column, chart.measure_column ? (column_agg_kinds?.[chart.measure_column] || 'sum') : null)
                : null
              const activeCategory = categoryFilter && categoryFilter.column === chart.category_column ? categoryFilter.value : null
              return (
                <BarChartCard
                  key={i}
                  chart={chart}
                  liveBars={liveBars}
                  isLive={isLive}
                  activeCategory={activeCategory}
                  onBarClick={handleBarClick}
                />
              )
            })}
          </div>
        </div>
      )}

      {pieCharts.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-ink/40 font-body">Proportions</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pieCharts.map((chart, i) => <PieChartCard key={i} chart={chart} />)}
          </div>
        </div>
      )}

      {secondarySummaryCards.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-ink/40 font-body">Key Numbers</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {secondarySummaryCards.map((chart, i) => {
              const liveStats = isLive
                ? recomputeSummaryCard(filteredRows, chart.measure_column, column_agg_kinds?.[chart.measure_column] || 'sum')
                : null
              return <SummaryCard key={i} chart={chart} liveStats={liveStats} isLive={isLive} />
            })}
          </div>
        </div>
      )}

      {histogramCharts.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wide text-ink/40 font-body">Distributions</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {histogramCharts.map((chart, i) => {
              const liveHist = isLive
                ? recomputeHistogram(filteredRows, chart.measure_column)
                : null
              return <HistogramChartCard key={i} chart={chart} liveHist={liveHist} isLive={isLive} />
            })}
          </div>
        </div>
      )}

      {sample_rows && sample_rows.length > 0 && (
        <ExploreSection sampleRows={filteredRows} chartableColumns={chartable_columns} labels={labels} totalRows={n_rows} />
      )}

      <DataQualityReport report={data_quality} labels={labels} />

      <ColumnCorrector
        columnTypes={column_types}
        columnAggKinds={column_agg_kinds}
        columnConfidence={column_confidence}
        labels={labels}
        userCorrectedColumns={user_corrected_columns}
        correctionNotes={correction_notes}
        onApply={onApplyCorrections}
      />
    </div>
  )
}
