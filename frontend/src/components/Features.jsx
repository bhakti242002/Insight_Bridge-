const FEATURES = [
  {
    title: 'Works with any spreadsheet',
    body: 'Sales, grades, inventory, attendance: whatever you upload. Column types are figured out from your actual data, not guessed from a business template.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#818CF8" strokeWidth="1.6" />
        <path d="M3 9h18M9 4v16" stroke="#818CF8" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: 'AI-assisted, always verified',
    body: 'AI suggests labels and how numbers should be aggregated. Statistics, not AI guesses, decide what actually gets computed and charted.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" stroke="#818CF8" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="#FF6B52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Real insights, not just charts',
    body: "Every chart comes with a plain-English takeaway: what's highest, what changed, what's related, not just axes to interpret yourself.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3z" stroke="#818CF8" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M10 20h4" stroke="#FF6B52" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Click to filter, drill into anything',
    body: 'Click a bar in any chart to filter the whole dashboard to that value. Pick a date range and watch every number update together.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16l-6 8v6l-4 2v-8L4 4z" stroke="#818CF8" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="18" cy="17" r="3" stroke="#FF6B52" strokeWidth="1.8" />
        <path d="M18 15.5v3M16.5 17h3" stroke="#FF6B52" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function Features() {
  return (
    <section id="features" className="py-4">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-4">What it does</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((f, i) => (
          <div key={i} className="bg-surface border border-rule rounded-lg shadow-sm p-5">
            <div className="mb-3">{f.icon}</div>
            <div className="font-display font-semibold text-ink mb-1.5">{f.title}</div>
            <div className="text-sm font-body text-ink/60 leading-relaxed">{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
