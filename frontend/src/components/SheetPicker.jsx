export default function SheetPicker({ sheets, filename, onPick, onCancel }) {
  return (
    <div className="bg-surface border border-rule rounded-lg shadow-sm p-6">
      <div className="font-display text-lg text-ink mb-1">This file has multiple sheets</div>
      <div className="text-sm text-ink/60 font-body mb-5">
        {filename} contains {sheets.length} sheets. Which one do you want to analyze?
      </div>
      <div className="space-y-2">
        {sheets.map((s) => (
          <button
            key={s.name}
            onClick={() => onPick(s.name)}
            className="w-full text-left bg-paper border border-rule hover:border-ledger rounded-md p-3 flex items-center justify-between transition-colors"
          >
            <span className="font-body text-ink font-medium">{s.name}</span>
            <span className="text-xs font-mono text-ink/40">{s.n_rows.toLocaleString()} rows, {s.n_cols} cols</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="text-xs font-body text-ink/40 hover:text-ink/60 underline mt-4"
      >
        Upload a different file instead
      </button>
    </div>
  )
}
