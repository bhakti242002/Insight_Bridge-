export default function Footer() {
  return (
    <footer className="border-t border-rule mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between gap-4 text-sm font-body text-ink/50">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 15l2.5-4 3 2.5L18 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display font-semibold text-ink/70">Insight Bridge</span>
        </div>
        <div>Files are read in memory and never saved to disk.</div>
        <div>Built with Python, React, and the Claude API.</div>
      </div>
    </footer>
  )
}
