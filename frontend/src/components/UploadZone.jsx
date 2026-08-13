import { useState, useRef } from 'react'

export default function UploadZone({ onFileSelected, disabled }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFileSelected(file)
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-md p-10 text-center cursor-pointer transition-colors
        ${isDragging ? 'border-ledger bg-ledger-light' : 'border-rule bg-surface/60'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-ledger'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      <div className="font-display text-lg text-ink mb-1">
        Drop your spreadsheet here
      </div>
      <div className="text-sm text-ink/60 font-body">
        or click to browse (.csv or .xlsx, up to 5MB)
      </div>
      <div className="mt-4 inline-block px-4 py-2 bg-stamp text-white text-sm font-body font-medium rounded-md">
        Choose file
      </div>
    </div>
  )
}
