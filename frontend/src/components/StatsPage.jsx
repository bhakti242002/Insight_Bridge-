import { useEffect, useState } from 'react'

export default function StatsPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const key = params.get('key') || ''
    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

    fetch(`${apiBase}/api/stats?key=${encodeURIComponent(key)}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Wrong or missing key.' : 'Could not load stats.')
        return res.json()
      })
      .then(setStats)
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-ink/60 font-body text-sm">{error}</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-ink/60 font-body text-sm">Loading...</div>
      </div>
    )
  }

  const days = Object.entries(stats.uploads_by_day || {})
  const maxCount = Math.max(1, ...days.map(([, c]) => c))

  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="font-display text-xl font-semibold text-ink">Usage stats</div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-rule rounded-lg p-5">
            <div className="text-xs uppercase tracking-wide text-ink/50 font-body">Total uploads</div>
            <div className="text-3xl font-display font-bold text-ledger mt-1">{stats.total_uploads}</div>
          </div>
          <div className="bg-surface border border-rule rounded-lg p-5">
            <div className="text-xs uppercase tracking-wide text-ink/50 font-body">Days active</div>
            <div className="text-3xl font-display font-bold text-ledger mt-1">{stats.unique_days_active}</div>
          </div>
        </div>

        <div className="bg-surface border border-rule rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-3">Uploads by day</div>
          {days.length === 0 ? (
            <div className="text-sm text-ink/40 font-body">No uploads recorded yet.</div>
          ) : (
            <div className="space-y-1.5">
              {days.map(([day, count]) => (
                <div key={day} className="flex items-center gap-2">
                  <div className="text-xs font-mono text-ink/50 w-24">{day}</div>
                  <div className="flex-1 bg-paper rounded-sm h-4 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-ledger to-stamp"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs font-mono text-ink/60 w-8 text-right">{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-ink/30 font-body">
          Data source: {stats.source === 'supabase' ? 'Supabase (production)' : 'local file (dev)'}
        </div>
      </div>
    </div>
  )
}
