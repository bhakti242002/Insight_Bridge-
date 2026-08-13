import { useState, useMemo } from 'react'
import {
  BarChart, Bar, ScatterChart, Scatter, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { trimmedBounds } from '../lib/chartCompute'

const PALETTE = ['#818CF8', '#FF6B52', '#34D399', '#FBBF24', '#60A5FA', '#F472B6', '#A78BFA', '#2DD4BF']

function formatAxisNumber(n) {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString()
  return Number(n.toFixed(2))
}

function buildHistogram(rows, col, binCount = 12) {
  const values = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && !isNaN(v))
  if (values.length === 0) return { bins: [], total: 0, trimmed: false }
  const trueMin = Math.min(...values)
  const trueMax = Math.max(...values)
  if (trueMin === trueMax) return { bins: [{ bin: `${formatAxisNumber(trueMin)}`, count: values.length }], total: values.length, trimmed: false }
  const [min, max] = trimmedBounds(values)
  const binSize = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, i) => ({
    bin: `${formatAxisNumber(min + i * binSize)}-${formatAxisNumber(min + (i + 1) * binSize)}`,
    count: 0,
  }))
  values.forEach(v => {
    let idx = Math.floor((v - min) / binSize)
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    bins[idx].count += 1
  })
  return { bins, total: values.length, trimmed: min > trueMin || max < trueMax }
}

function describeHistogram(bins, total) {
  if (bins.length === 0 || total === 0) return null
  const maxBin = bins.reduce((a, b) => (b.count > a.count ? b : a))
  if (maxBin.count === 0) return null
  const pct = Math.round((maxBin.count / total) * 100)
  return `Most common range: ${maxBin.bin}, with ${maxBin.count.toLocaleString()} of ${total.toLocaleString()} rows (${pct}%).`
}

function buildScatterData(rows, xCol, yCol, cap = 1000) {
  const points = rows
    .map(r => ({ x: r[xCol], y: r[yCol] }))
    .filter(p => p.x !== null && p.y !== null && !isNaN(p.x) && !isNaN(p.y))
  if (points.length <= cap) return points
  const step = Math.ceil(points.length / cap)
  return points.filter((_, i) => i % step === 0)
}

function linearRegressionLine(points) {
  const n = points.length
  if (n < 2) return null
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, denom = 0
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY)
    denom += (p.x - meanX) ** 2
  }
  if (denom === 0) return null
  const slope = num / denom
  const intercept = meanY - slope * meanX
  const xs = points.map(p => p.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  return [
    { x: minX, trend: slope * minX + intercept },
    { x: maxX, trend: slope * maxX + intercept },
  ]
}

function pearsonCorrelation(points) {
  const n = points.length
  if (n < 2) return null
  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, denomX = 0, denomY = 0
  for (const p of points) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }
  if (denomX === 0 || denomY === 0) return null
  return num / Math.sqrt(denomX * denomY)
}

function describeCorrelation(r, labelA, labelB) {
  if (r === null || isNaN(r)) return null
  const abs = Math.abs(r)
  const direction = r > 0 ? 'positive' : 'negative'
  if (abs < 0.2) return `Little to no relationship between ${labelA} and ${labelB} (r = ${r.toFixed(2)}).`
  const strength = abs >= 0.7 ? 'Strong' : abs >= 0.4 ? 'Moderate' : 'Weak'
  const verb = direction === 'positive' ? 'tends to rise' : 'tends to fall'
  return `${strength} ${direction} relationship (r = ${r.toFixed(2)}). As ${labelA} increases, ${labelB} ${verb}.`
}

function buildPieData(rows, col, topN = 7) {
  const counts = {}
  let total = 0
  rows.forEach(r => {
    const v = r[col]
    if (v === null || v === undefined) return
    counts[v] = (counts[v] || 0) + 1
    total += 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, topN).map(([name, value]) => ({ name, value }))
  const restSum = sorted.slice(topN).reduce((sum, [, v]) => sum + v, 0)
  if (restSum > 0) top.push({ name: 'Other', value: restSum })
  return { pieData: top, total }
}

function describePie(pieData, total) {
  if (pieData.length === 0 || total === 0) return null
  const top = pieData[0]
  const pct = Math.round((top.value / total) * 100)
  return `${top.name} accounts for ${pct}% of all rows (${top.value.toLocaleString()} of ${total.toLocaleString()}).`
}

function InsightLine({ text }) {
  if (!text) return null
  return (
    <div className="mt-3 pt-3 border-t border-rule/60 text-sm font-body text-ink">
      {text}
    </div>
  )
}

function ColumnSelect({ label, value, onChange, options }) {
  return (
    <label className="text-xs font-body text-ink/60 flex flex-col gap-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
        className="border border-rule rounded-md px-2 py-1 text-sm font-body bg-surface text-ink"
      >
        <option value="">Select a column…</option>
        {options.map(col => <option key={col} value={col}>{col}</option>)}
      </select>
    </label>
  )
}

export default function ExploreSection({ sampleRows, chartableColumns, labels, totalRows }) {
  const [chartKind, setChartKind] = useState('histogram')
  const [colA, setColA] = useState('')
  const [colB, setColB] = useState('')

  const numericCols = Object.keys(chartableColumns).filter(c => chartableColumns[c] === 'numeric_measure')
  const categoricalCols = Object.keys(chartableColumns).filter(c => ['categorical', 'boolean'].includes(chartableColumns[c]))

  const label = (col) => labels?.[col] || col

  const { bins: histogramBins, total: histogramTotal, trimmed: histogramTrimmed } = useMemo(
    () => (chartKind === 'histogram' && colA ? buildHistogram(sampleRows, colA) : { bins: [], total: 0, trimmed: false }),
    [chartKind, colA, sampleRows]
  )
  const scatterData = useMemo(
    () => (chartKind === 'scatter' && colA && colB ? buildScatterData(sampleRows, colA, colB) : []),
    [chartKind, colA, colB, sampleRows]
  )
  const { pieData, total: pieTotal } = useMemo(
    () => (chartKind === 'pie' && colA ? buildPieData(sampleRows, colA) : { pieData: [], total: 0 }),
    [chartKind, colA, sampleRows]
  )

  const correlation = useMemo(() => pearsonCorrelation(scatterData), [scatterData])
  const trendLine = useMemo(() => linearRegressionLine(scatterData), [scatterData])

  if (Object.keys(chartableColumns).length === 0) return null

  const isFullData = totalRows === undefined || sampleRows.length >= totalRows

  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-5">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-3">
        Explore your data
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex gap-1">
          {['histogram', 'scatter', 'pie'].map(kind => (
            <button
              key={kind}
              onClick={() => { setChartKind(kind); setColA(''); setColB('') }}
              className={`text-xs font-body px-3 py-1.5 rounded-full border ${
                chartKind === kind
                  ? 'bg-ledger text-white border-ledger'
                  : 'bg-surface text-ink/60 border-rule hover:border-ledger'
              }`}
            >
              {kind === 'histogram' ? 'Distribution' : kind === 'scatter' ? 'Relationship' : 'Proportions'}
            </button>
          ))}
        </div>

        {chartKind === 'histogram' && (
          <ColumnSelect label="Number to distribute" value={colA} onChange={setColA} options={numericCols} />
        )}
        {chartKind === 'scatter' && (
          <>
            <ColumnSelect label="X axis" value={colA} onChange={setColA} options={numericCols} />
            <ColumnSelect label="Y axis" value={colB} onChange={setColB} options={numericCols} />
          </>
        )}
        {chartKind === 'pie' && (
          <ColumnSelect label="Category" value={colA} onChange={setColA} options={categoricalCols} />
        )}
      </div>

      {chartKind === 'histogram' && colA && histogramBins.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={histogramBins} margin={{ bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232B3D" />
              <XAxis dataKey="bin" tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }} angle={-35} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }} />
              <Tooltip contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
              <Bar dataKey="count" fill="#818CF8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <InsightLine text={describeHistogram(histogramBins, histogramTotal)} />
          {histogramTrimmed && (
            <div className="text-xs font-body text-stamp mt-2">
              Some extreme values fall outside the range shown and were grouped into the outer bin so they don't compress the rest of the chart.
            </div>
          )}
        </>
      )}

      {chartKind === 'scatter' && colA && colB && scatterData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart margin={{ bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232B3D" />
              <XAxis
                type="number"
                dataKey="x"
                name={label(colA)}
                domain={['auto', 'auto']}
                tickFormatter={formatAxisNumber}
                tickCount={6}
                tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}
                label={{ value: label(colA), position: 'insideBottom', offset: -5, fontSize: 11, fill: '#B8C0D4' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={label(colB)}
                domain={['auto', 'auto']}
                tickFormatter={formatAxisNumber}
                tickCount={6}
                tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}
                label={{ value: label(colB), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#B8C0D4' }}
              />
              <ZAxis range={[20, 20]} />
              <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#8B93A7' }} contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
              <Scatter data={scatterData} dataKey="y" fill="#FF6B52" fillOpacity={0.5} />
              {trendLine && (
                <Line
                  data={trendLine}
                  dataKey="trend"
                  stroke="#818CF8"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <InsightLine text={describeCorrelation(correlation, label(colA), label(colB))} />
        </>
      )}

      {chartKind === 'pie' && colA && pieData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#B8C0D4' }}>
                {pieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1B2333', border: '1px solid #232B3D', borderRadius: '8px', color: '#E7EAF3', fontFamily: 'IBM Plex Sans' }} labelStyle={{ color: '#E7EAF3' }} itemStyle={{ color: '#E7EAF3' }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Sans', color: '#E7EAF3' }} />
            </PieChart>
          </ResponsiveContainer>
          <InsightLine text={describePie(pieData, pieTotal)} />
        </>
      )}

      {((chartKind === 'histogram' && !colA) || (chartKind === 'scatter' && (!colA || !colB)) || (chartKind === 'pie' && !colA)) && (
        <div className="text-sm text-ink/40 font-body text-center py-8">
          Pick a column above to build this chart.
        </div>
      )}

      <div className="text-xs text-ink/40 font-body mt-3">
        {isFullData
          ? `Built from all ${sampleRows.length.toLocaleString()} rows.`
          : `Built from ${sampleRows.length.toLocaleString()} of ${totalRows.toLocaleString()} rows.`}
      </div>
    </div>
  )
}
