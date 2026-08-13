import { useState, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Features from './components/Features'
import ProductPreview from './components/ProductPreview'
import UploadZone from './components/UploadZone'
import Dashboard from './components/Dashboard'
import StatsPage from './components/StatsPage'
import SheetPicker from './components/SheetPicker'
import { analyzeSpreadsheet } from './api'

export default function App() {
  const [status, setStatus] = useState('idle') // idle | loading | picking-sheet | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [sheetOptions, setSheetOptions] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [chosenSheet, setChosenSheet] = useState(null)
  const [confirmedOverrides, setConfirmedOverrides] = useState({})
  const uploadSectionRef = useRef(null)

  const isStatsPage = new URLSearchParams(window.location.search).get('stats') === '1'
  if (isStatsPage) return <StatsPage />

  async function handleFile(file) {
    setStatus('loading')
    setError(null)
    try {
      const data = await analyzeSpreadsheet(file)
      if (data.multiple_sheets) {
        setPendingFile(file)
        setSheetOptions(data.sheets)
        setStatus('picking-sheet')
        return
      }
      setUploadedFile(file)
      setChosenSheet(null)
      setConfirmedOverrides({})
      setResult(data)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  async function handleSheetPick(sheetName) {
    setStatus('loading')
    try {
      const data = await analyzeSpreadsheet(pendingFile, sheetName)
      setUploadedFile(pendingFile)
      setChosenSheet(sheetName)
      setConfirmedOverrides({})
      setResult(data)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    } finally {
      setPendingFile(null)
      setSheetOptions(null)
    }
  }

  async function handleApplyCorrections(newOverrides) {
    if (!uploadedFile) return
    // Merge with everything confirmed in earlier rounds and always send the
    // FULL accumulated set -- the backend is stateless and recomputes from
    // scratch each time, so sending only the latest batch would silently
    // undo any corrections confirmed in a previous round.
    const merged = { ...confirmedOverrides, ...newOverrides }
    setStatus('loading')
    try {
      const data = await analyzeSpreadsheet(uploadedFile, chosenSheet, merged)
      setConfirmedOverrides(merged)
      setResult(data)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setPendingFile(null)
    setSheetOptions(null)
    setUploadedFile(null)
    setChosenSheet(null)
    setConfirmedOverrides({})
  }

  function scrollToUpload() {
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {status === 'idle' && <Header onGetStarted={scrollToUpload} />}
      {status !== 'idle' && (
        <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#818CF8" strokeWidth="1.8" />
              <path d="M8 15l2.5-4 3 2.5L18 8" stroke="#FF6B52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display font-semibold text-lg text-ledger">Insight Bridge</span>
          </div>
          {status === 'done' && (
            <button
              onClick={reset}
              className="text-sm font-body font-medium bg-ledger hover:bg-ledger-dark transition-colors text-white px-4 py-2 rounded-md"
            >
              Analyze another file
            </button>
          )}
        </header>
      )}

      <main className={`flex-1 ${status === 'done' ? 'max-w-6xl mx-auto px-6 py-10 w-full' : 'max-w-3xl mx-auto px-6 py-14 w-full'}`}>
        {status === 'idle' && (
          <>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink leading-tight mb-3">
              Upload any messy spreadsheet.<br />Get a dashboard.
            </h1>
            <p className="text-ink/70 font-body mb-10 max-w-lg">
              Sales, grades, inventory, attendance: whatever you've got.
              No Power BI. No Tableau. No formulas. We figure out what's
              actually in your data directly from the numbers themselves,
              not by guessing what your business is.
            </p>

            <div ref={uploadSectionRef}>
              <UploadZone onFileSelected={handleFile} disabled={false} />
            </div>

            <p className="text-xs text-ink/40 font-body mt-4">
              Your file is read in memory to build your dashboard and never saved to disk.
            </p>

            <div className="mt-16 pt-10 border-t border-rule">
              <Features />
            </div>

            <div className="mt-16 pt-10 border-t border-rule">
              <ProductPreview />
            </div>

            <div id="how-it-works" className="mt-16 pt-10 border-t border-rule">
              <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-4">How it works</div>
              <ol className="space-y-3 font-body text-sm text-ink/80">
                <li><span className="font-mono text-ledger mr-2">01</span>You upload a .csv or .xlsx file: sales, grades, inventory, job postings, anything with rows and columns.</li>
                <li><span className="font-mono text-ledger mr-2">02</span>We figure out what each column really is by checking the actual data, not its name, then let AI suggest clean labels and catch anything the statistics missed.</li>
                <li><span className="font-mono text-ledger mr-2">03</span>You get charts built from those verified types, plain-English insights under each one, and a data quality check that flags missing values and outliers.</li>
                <li><span className="font-mono text-ledger mr-2">04</span>Then just ask it a question in plain English. No formulas, no dashboard-building skills, just answers pulled straight from your own numbers.</li>
              </ol>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-ledger/20 border-t-ledger rounded-full animate-spin mb-4" />
            <div className="font-display text-lg text-ink mb-1">Reading your spreadsheet…</div>
            <div className="text-sm text-ink/50 font-body">This usually takes a few seconds.</div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-20">
            <div className="font-display text-lg text-ink mb-2">Something went wrong</div>
            <div className="text-sm text-ink/60 font-body mb-6">{error}</div>
            <button
              onClick={reset}
              className="px-4 py-2 bg-stamp hover:bg-stamp-dark transition-colors text-white text-sm font-body font-medium rounded-md"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'picking-sheet' && sheetOptions && (
          <SheetPicker
            sheets={sheetOptions}
            filename={pendingFile?.name || 'This file'}
            onPick={handleSheetPick}
            onCancel={reset}
          />
        )}

        {status === 'done' && result && <Dashboard result={result} onApplyCorrections={handleApplyCorrections} />}
      </main>

      {status === 'idle' && <Footer />}
    </div>
  )
}
