export default function TransformHero() {
  return (
    <div className="relative h-64 md:h-72 flex items-center justify-center">
      {/* Ambient glow */}
      <div className="absolute w-72 h-72 bg-ledger/25 rounded-full blur-3xl" />
      <div className="absolute w-56 h-56 bg-stamp/20 rounded-full blur-3xl translate-x-24 translate-y-8" />

      {/* Floating cards at different depths */}
      <div className="relative w-full max-w-md h-full">
        <div className="absolute top-2 left-4 md:left-8 w-40 bg-surface border border-rule rounded-lg shadow-lg p-3 -rotate-6">
          <div className="text-[9px] uppercase tracking-wide text-ink/40 font-body">Revenue</div>
          <div className="text-lg font-display font-bold text-ledger">$932.3K</div>
          <div className="flex items-end gap-1 h-6 mt-2">
            {[40, 65, 45, 80, 60].map((h, i) => (
              <div key={i} className="flex-1 bg-stamp/70 rounded-t-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        <div className="absolute top-16 right-2 md:right-6 w-44 bg-surface border border-rule rounded-lg shadow-lg p-3 rotate-3">
          <div className="text-[9px] uppercase tracking-wide text-ink/40 font-body mb-1">Trend</div>
          <svg viewBox="0 0 100 30" className="w-full h-8">
            <polyline points="0,25 20,20 40,22 60,10 80,8 100,3" fill="none" stroke="#818CF8" strokeWidth="2.5" />
          </svg>
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 bg-surface border border-ledger/30 rounded-lg shadow-lg p-3 glow-ring">
          <div className="text-[9px] uppercase tracking-wide text-ink/40 font-body mb-1.5">Key Insight</div>
          <div className="text-xs font-body text-ink/80 leading-snug">
            Foot Locker leads by a wide margin across every region.
          </div>
        </div>
      </div>
    </div>
  )
}
