export default function Header({ onGetStarted }) {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="sticky top-0 z-10 bg-paper/95 backdrop-blur-sm border-b border-rule">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#818CF8" strokeWidth="1.8" />
            <path d="M8 15l2.5-4 3 2.5L18 8" stroke="#FF6B52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display font-semibold text-lg text-ledger">Insight Bridge</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-body text-ink/60">
          <button onClick={() => scrollTo('features')} className="hover:text-ink transition-colors">Features</button>
          <button onClick={() => scrollTo('how-it-works')} className="hover:text-ink transition-colors">How it works</button>
          <button onClick={() => scrollTo('preview')} className="hover:text-ink transition-colors">Preview</button>
        </nav>
        <button
          onClick={onGetStarted}
          className="text-sm font-body font-medium bg-ledger hover:bg-ledger-dark transition-colors text-white px-4 py-2 rounded-md"
        >
          Get started
        </button>
      </div>
    </header>
  )
}
