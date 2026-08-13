export default function DatasetOverview({ text }) {
  if (!text) return null
  return (
    <div className="bg-surface-light border border-rule rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-body mb-2">About this dataset</div>
      <p className="text-sm font-body text-ink/80 leading-relaxed">{text}</p>
    </div>
  )
}
