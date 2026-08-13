// chartCompute.js
//
// Mirrors chart_engine.py's aggregation rules (sum vs average, minimum
// group size) so charts can be recomputed live from filtered rows without
// a server round-trip. This only runs once a filter is active -- the
// initial unfiltered dashboard always uses the server-computed values
// from the full dataset, which is more accurate than this sample-based
// recomputation.

// Mirrors type_inference.py's trimmed_mean / _trimmed_bounds exactly, so
// applying a filter doesn't undo the outlier-resistance fixed server-side
// for the initial unfiltered view. Uses the same linear-interpolation
// quantile method as pandas' default, verified to match numerically.
function quantile(sortedArr, q) {
  const pos = (sortedArr.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base])
  }
  return sortedArr[base]
}

function trimmedMean(values, multiplier = 3) {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  if (iqr === 0) return values.reduce((a, b) => a + b, 0) / values.length
  const lower = q1 - multiplier * iqr
  const upper = q3 + multiplier * iqr
  const trimmed = values.filter(v => v >= lower && v <= upper)
  if (trimmed.length === 0) return values.reduce((a, b) => a + b, 0) / values.length
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
}

export function trimmedBounds(values, multiplier = 3) {
  if (values.length === 0) return [NaN, NaN]
  const sorted = [...values].sort((a, b) => a - b)
  const trueMin = sorted[0]
  const trueMax = sorted[sorted.length - 1]
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  if (iqr === 0) return [trueMin, trueMax]
  const lower = Math.max(trueMin, q1 - multiplier * iqr)
  const upper = Math.min(trueMax, q3 + multiplier * iqr)
  if (lower >= upper) return [trueMin, trueMax]
  return [lower, upper]
}

const MIN_GROUP_SIZE_FOR_AVERAGE = 5
const TOP_N_CATEGORIES = 8

function pickGrouping(dates) {
  if (dates.length === 0) return 'M'
  const sorted = [...dates].sort()
  const spanDays = (new Date(sorted[sorted.length - 1]) - new Date(sorted[0])) / 86400000
  if (spanDays > 180) return 'M'
  if (spanDays > 21) return 'W'
  return 'D'
}

function periodKey(dateStr, grouping) {
  const d = new Date(dateStr)
  if (grouping === 'M') return dateStr.slice(0, 7)
  if (grouping === 'D') return dateStr.slice(0, 10)
  // Week: ISO-ish week start (Sunday-based, matches pandas default roughly enough for display purposes)
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  return start.toISOString().slice(0, 10)
}

export function recomputeSummaryCard(rows, measureCol, aggKind) {
  const values = rows.map(r => r[measureCol]).filter(v => v !== null && v !== undefined && !isNaN(v))
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  const mean = aggKind === 'average' ? trimmedMean(values) : sum / values.length
  return {
    agg_kind: aggKind,
    sum: Math.round(sum * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

export function recomputeLineChart(rows, dateCol, measureCol, aggKind, grouping) {
  const points = rows
    .map(r => ({ date: r[dateCol], value: r[measureCol] }))
    .filter(p => p.date && p.value !== null && p.value !== undefined && !isNaN(p.value))
  if (points.length === 0) return []

  const g = grouping || pickGrouping(points.map(p => p.date))
  const groups = {}
  points.forEach(p => {
    const key = periodKey(p.date, g)
    if (!groups[key]) groups[key] = []
    groups[key].push(p.value)
  })

  let entries = Object.entries(groups)
  if (aggKind === 'average') {
    entries = entries.filter(([, vals]) => vals.length >= MIN_GROUP_SIZE_FOR_AVERAGE)
  }

  return entries
    .map(([period, vals]) => ({
      period,
      value: Math.round((aggKind === 'average'
        ? trimmedMean(vals)
        : vals.reduce((a, b) => a + b, 0)) * 100) / 100,
    }))
    .sort((a, b) => (a.period > b.period ? 1 : -1))
}

export function recomputeBarChart(rows, catCol, measureCol, aggKind) {
  const groups = {}
  rows.forEach(r => {
    const cat = r[catCol]
    if (cat === null || cat === undefined) return
    if (!groups[cat]) groups[cat] = []
    if (measureCol) {
      const v = r[measureCol]
      if (v !== null && v !== undefined && !isNaN(v)) groups[cat].push(v)
    } else {
      groups[cat].push(1) // plain count
    }
  })

  let entries = Object.entries(groups).filter(([, vals]) => vals.length > 0)
  if (measureCol && aggKind === 'average') {
    entries = entries.filter(([, vals]) => vals.length >= MIN_GROUP_SIZE_FOR_AVERAGE)
  }

  const bars = entries.map(([category, vals]) => ({
    category,
    value: Math.round((measureCol && aggKind === 'average'
      ? trimmedMean(vals)
      : vals.reduce((a, b) => a + b, 0)) * 100) / 100,
  }))

  bars.sort((a, b) => b.value - a.value)
  return bars.slice(0, TOP_N_CATEGORIES)
}

export function recomputeHistogram(rows, measureCol, binCount = 10) {
  const values = rows.map(r => r[measureCol]).filter(v => v !== null && v !== undefined && !isNaN(v))
  if (values.length === 0) return { bins: [], total: 0 }
  const trueMin = Math.min(...values)
  const trueMax = Math.max(...values)
  if (trueMin === trueMax) return { bins: [{ bin: `${trueMin}`, count: values.length }], total: values.length }
  const [min, max] = trimmedBounds(values)
  const binSize = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, i) => ({
    bin: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
    count: 0,
  }))
  values.forEach(v => {
    let idx = Math.floor((v - min) / binSize)
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    bins[idx].count += 1
  })
  return { bins, total: values.length }
}

const TRUTHY_STRINGS = new Set(['true', 'yes', 'y', '1'])
const FALSY_STRINGS = new Set(['false', 'no', 'n', '0'])

function normalizeBooleanish(val) {
  const s = String(val).trim().toLowerCase()
  if (TRUTHY_STRINGS.has(s)) return true
  if (FALSY_STRINGS.has(s)) return false
  return null
}

function compareOrdered(v, target, op) {
  const numV = Number(v)
  const numTarget = Number(target)
  const useString = isNaN(numV) || isNaN(numTarget)
  const a = useString ? String(v) : numV
  const b = useString ? String(target) : numTarget
  switch (op) {
    case '>': return a > b
    case '<': return a < b
    case '>=': return a >= b
    case '<=': return a <= b
  }
}

export function matchesFilter(row, filter) {
  const v = row[filter.column]
  if (v === null || v === undefined) return false
  const target = filter.value

  if (filter.operator === '==' || filter.operator === '!=') {
    const normV = normalizeBooleanish(v)
    const normTarget = normalizeBooleanish(target)
    if (normV !== null && normTarget !== null) {
      return filter.operator === '==' ? normV === normTarget : normV !== normTarget
    }
  }

  switch (filter.operator) {
    case '>': case '<': case '>=': case '<=':
      return compareOrdered(v, target, filter.operator)
    case '==': return typeof target === 'number' ? Number(v) === Number(target) : String(v).toLowerCase() === String(target).toLowerCase()
    case '!=': return typeof target === 'number' ? Number(v) !== Number(target) : String(v).toLowerCase() !== String(target).toLowerCase()
    default: return true
  }
}

function aggregate(values, operation) {
  if (operation === 'count') return values.length
  const nums = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number)
  if (nums.length === 0) return null
  if (operation === 'sum') return nums.reduce((a, b) => a + b, 0)
  if (operation === 'average') return nums.reduce((a, b) => a + b, 0) / nums.length
  if (operation === 'min') return Math.min(...nums)
  if (operation === 'max') return Math.max(...nums)
  return null
}

export function executeQuerySpec(rows, spec) {
  const filters = spec.filters || []
  const filtered = rows.filter(r => filters.every(f => matchesFilter(r, f)))

  // "Which record has the highest/lowest X" style questions -- find the
  // actual row(s), not just the bare aggregate number.
  if (spec.return_columns?.length > 0 && (spec.operation === 'max' || spec.operation === 'min') && !spec.group_by) {
    const validRows = filtered.filter(r => {
      const v = r[spec.target_column]
      return v !== null && v !== undefined && !isNaN(v)
    })
    if (validRows.length === 0) {
      return { type: 'lookup', matchedRows: filtered.length, rows: [] }
    }
    const extreme = spec.operation === 'max'
      ? Math.max(...validRows.map(r => Number(r[spec.target_column])))
      : Math.min(...validRows.map(r => Number(r[spec.target_column])))
    const matchingRows = validRows.filter(r => Number(r[spec.target_column]) === extreme)
    const resultRows = matchingRows.slice(0, 5).map(r => {
      const out = { [spec.target_column]: r[spec.target_column] }
      spec.return_columns.forEach(col => { out[col] = r[col] })
      return out
    })
    return {
      type: 'lookup',
      matchedRows: filtered.length,
      rows: resultRows,
      truncated: matchingRows.length > 5,
      totalMatching: matchingRows.length,
    }
  }

  if (spec.group_by) {
    const groups = {}
    filtered.forEach(r => {
      const key = r[spec.group_by]
      if (key === null || key === undefined) return
      if (!groups[key]) groups[key] = []
      groups[key].push(spec.target_column ? r[spec.target_column] : null)
    })
    const results = Object.entries(groups).map(([key, values]) => ({
      group: key,
      value: aggregate(values, spec.operation),
      n: values.length,
    }))
    return { type: 'grouped', matchedRows: filtered.length, results }
  }

  const values = spec.target_column ? filtered.map(r => r[spec.target_column]) : filtered
  const result = aggregate(values, spec.operation)
  return { type: 'single', matchedRows: filtered.length, result }
}

export function filterRows(rows, { dateColumn, dateRange, categoryFilter }) {
  return rows.filter(r => {
    if (dateColumn && dateRange && (dateRange.start || dateRange.end)) {
      const d = r[dateColumn]
      if (!d) return false
      if (dateRange.start && d < dateRange.start) return false
      if (dateRange.end && d > dateRange.end) return false
    }
    if (categoryFilter && r[categoryFilter.column] !== categoryFilter.value) {
      return false
    }
    return true
  })
}
