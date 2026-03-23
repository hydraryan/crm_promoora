import { useRef, useState } from 'react'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { type Invoice } from '@/utils/invoiceConstants'
import { InvoiceDocument } from './InvoiceDocument'
import './invoicePrint.css'

interface InvoicePreviewProps {
  invoice: Invoice
  role: string
  onClose: () => void
  onEdit: () => void
  onUpdated: (invoice: Invoice) => void
}

export default function InvoicePreview({ invoice, role, onClose, onEdit, onUpdated }: InvoicePreviewProps) {
  const [working, setWorking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const documentRef = useRef<HTMLDivElement | null>(null)

  const canManage = role === 'admin'

  async function markPaid() {
    setWorking(true)
    try {
      const updated = await apiFetch<{ invoice: Invoice }>(`/invoices/${invoice._id}/paid`, { method: 'PATCH' })
      onUpdated(updated.invoice)
    } finally {
      setWorking(false)
    }
  }

  async function markOverdue() {
    setWorking(true)
    try {
      const updated = await apiFetch<{ invoice: Invoice }>(`/invoices/${invoice._id}/overdue`, { method: 'PATCH' })
      onUpdated(updated.invoice)
    } finally {
      setWorking(false)
    }
  }

  async function downloadPdf() {
    if (!documentRef.current) return

    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      if (typeof document !== 'undefined' && 'fonts' in document) {
        await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
      }

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const fileName = `${invoice.invoiceNumber || 'invoice'}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Invoice PDF download failed:', error)
      window.alert('Unable to download PDF right now. Please try Save as PDF.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0a]">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#111111]">
            <ArrowLeft size={15} />
          </button>
          <p className="text-[13px] text-[#52525b]">{invoice.invoiceNumber}</p>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === 'Unpaid' && canManage && (
            <button
              onClick={markPaid}
              disabled={working}
              className="rounded-xl bg-[#22c55e]/10 px-3 py-1.5 text-[12px] text-[#22c55e] transition-colors duration-150 hover:bg-[#22c55e]/15"
            >
              Mark as paid
            </button>
          )}

          {invoice.status === 'Unpaid' && canManage && (
            <button
              onClick={markOverdue}
              disabled={working}
              className="rounded-xl bg-[#ef4444]/10 px-3 py-1.5 text-[12px] text-[#ef4444] transition-colors duration-150 hover:bg-[#ef4444]/15"
            >
              Mark as overdue
            </button>
          )}

          {(role === 'admin' || role === 'bd_intern') && (
            <button onClick={onEdit} className="rounded-xl bg-[#111111] px-3 py-1.5 text-[13px] text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a]">
              Edit
            </button>
          )}

          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]">
            <Printer size={13} />
            Save as PDF
          </button>

          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 rounded-xl bg-[#111111] px-4 py-1.5 text-[13px] font-medium text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={13} />
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div ref={documentRef} className="invoice-document mx-auto my-8 overflow-hidden rounded-xl bg-white shadow-2xl" style={{ maxWidth: 794 }}>
        <InvoiceDocument invoice={invoice} />
      </div>
    </div>
  )
}
