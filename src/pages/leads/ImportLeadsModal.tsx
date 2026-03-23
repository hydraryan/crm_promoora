import { useRef, useState, type DragEvent } from 'react'
import { Download, Upload, X } from 'lucide-react'

interface ImportResult {
  imported: number
  failed: number
  errors?: Array<{ row: number; reason: string }>
}

interface ImportLeadsModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportLeadsModal({ isOpen, onClose, onImported }: ImportLeadsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!isOpen) return null

  function downloadTemplate() {
    const cols = ['businessName', 'ownerName', 'phone', 'email', 'businessType', 'stage', 'source', 'notes']
    const csv = `${cols.join(',')}\n`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'promoora_leads_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      setFile(dropped)
      setResult(null)
      setError(null)
    }
  }

  async function handleImport() {
    if (!file) return
    setSubmitting(true)
    setError(null)
    try {
      const token = localStorage.getItem('crm_access_token')
      const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`${base}/leads/import`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      })

      if (!res.ok) {
        throw new Error(`Import failed with status ${res.status}`)
      }

      const data = (await res.json()) as ImportResult
      setResult(data)
      onImported()
    } catch {
      setError('Failed to import CSV')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-120 flex-col rounded-2xl border border-[#1f1f1f] bg-[#111111]">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Import leads</h2>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between rounded-xl bg-[#1a1a1a] p-3">
            <div>
              <p className="text-[13px] text-[#a1a1aa]">Download template</p>
              <p className="text-[11px] text-[#52525b]">CSV with required columns</p>
            </div>
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-[12px] text-[#6366f1] hover:text-[#818cf8]">
              <Download size={12} />
              template.csv
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-150 ${dragging ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'}`}
          >
            <Upload size={20} className="mx-auto mb-2 text-[#3f3f46]" />
            <p className="text-[13px] text-[#52525b]">{file ? file.name : 'Drop CSV here or click to upload'}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) {
                  setFile(selected)
                  setResult(null)
                  setError(null)
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Required columns</p>
            {['businessName', 'ownerName', 'phone', 'businessType'].map((col) => (
              <p key={col} className="font-['Geist_Mono'] text-[12px] text-[#52525b]">
                . {col}
              </p>
            ))}
            <p className="mt-1 text-[11px] text-[#3f3f46]">Optional: email, source, notes, stage</p>
          </div>

          {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}

          {result && (
            <div className="space-y-1 rounded-xl bg-[#1a1a1a] p-3">
              <p className="text-[13px] text-[#22c55e]">{result.imported} leads imported successfully</p>
              {result.failed > 0 && <p className="text-[12px] text-[#ef4444]">{result.failed} rows failed</p>}
              {result.errors?.map((e) => (
                <p key={`${e.row}-${e.reason}`} className="text-[11px] text-[#3f3f46]">
                  Row {e.row}: {e.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#1f1f1f] px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || submitting}
            className="rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:opacity-50"
          >
            {submitting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
