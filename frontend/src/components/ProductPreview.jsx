export default function ProductPreview() {
  return (
    <section id="preview" className="py-4">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-4">What you'll see</div>

      <div className="bg-surface border border-rule rounded-xl shadow-sm p-6 space-y-4 glow-ring">
        <div className="bg-gradient-to-br from-ledger-light to-surface-light border border-ledger/30 rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wide text-ink/50 font-body mb-2">Key Insights</div>
          <ul className="space-y-1.5">
            {['Foot Locker leads by a wide margin across every region.', 'Strong relationship between Operating Profit and Total Sales.', 'Most orders fall between $20 and $45 per unit.'].map((t, i) => (
              <li key={i} className="flex gap-2 text-xs font-body text-ink/80">
                <span className="text-stamp">*</span>{t}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-rule rounded-lg p-3 bg-paper">
            <div className="text-[10px] uppercase tracking-wide text-ink/40 font-body mb-2">Sales by Region</div>
            <div className="flex items-end gap-1.5 h-16">
              {[85, 65, 50, 45, 38].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-stamp to-stamp/50 rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="border border-rule rounded-lg p-3 bg-paper">
            <div className="text-[10px] uppercase tracking-wide text-ink/40 font-body mb-2">Revenue over time</div>
            <svg viewBox="0 0 100 40" className="w-full h-16">
              <polyline
                points="0,32 15,30 30,28 45,31 60,15 75,12 90,6 100,4"
                fill="none" stroke="#818CF8" strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        <div className="border border-ledger/30 rounded-lg p-3 bg-paper">
          <div className="text-[10px] uppercase tracking-wide text-ledger font-body mb-1">Ask a question</div>
          <div className="text-xs font-mono text-ink/50">"highest paying job" → Lead Data Scientist, $326,349</div>
        </div>
      </div>

      <div className="text-xs text-ink/40 font-body mt-3 text-center">
        Illustrative preview. Your dashboard is built from your actual data.
      </div>
    </section>
  )
}
