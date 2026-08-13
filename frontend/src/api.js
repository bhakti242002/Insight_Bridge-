const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

export async function analyzeSpreadsheet(file, sheetName = null, columnOverrides = null) {
  const formData = new FormData()
  formData.append('file', file)
  if (sheetName) formData.append('sheet_name', sheetName)
  if (columnOverrides) formData.append('column_overrides', JSON.stringify(columnOverrides))

  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong analyzing your file.')
  }

  return data
}
