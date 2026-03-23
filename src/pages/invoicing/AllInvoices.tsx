import { useEffect, useMemo, useState } from 'react'
import { Plus, ReceiptText } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { INVOICE_STATUSES, statusColors, type Invoice, type InvoiceStatus } from '@/utils/invoiceConstants'
import InvoiceBuilder from './InvoiceBuilder'
import InvoicePreview from './InvoicePreview'

type InvoicesResponse = {
  invoices: Invoice[]
}

interface AllInvoicesProps {
  role: string
  viewId: string
}

const viewStatusMap: Record<string, InvoiceStatus | 'all'> = {
  'invoicing/new': 'all',
  'invoicing/unpaid': 'Unpaid',
  'invoicing/paid': 'Paid',
  'invoicing/overdue': 'Overdue',
  'invoicing/all': 'all',
}

export default function AllInvoices({ role, viewId }: AllInvoicesProps) {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    let active = true

    async function loadInvoices() {
      try {
        const response = await apiFetch<InvoicesResponse>('/invoices')
        if (!active) return
        setInvoices(response.invoices || [])
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadInvoices()

    return () => {
      active = false
    }
  }, [])

  const filterStatus = viewStatusMap[viewId] || 'all'

  const filteredInvoices = useMemo(() => {
    let list = invoices
    if (filterStatus !== 'all') {
      list = list.filter((invoice) => invoice.status === filterStatus)
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filterStatus, invoices])

  function upsertInvoice(updated: Invoice) {
    setInvoices((current) => {
      const index = current.findIndex((invoice) => invoice._id === updated._id)
      if (index === -1) {
        return [updated, ...current]
      }
      const next = [...current]
      next[index] = updated
      return next
    })
  }

  function openNewInvoice() {
    setEditInvoice(null)
    setShowBuilder(true)
  }

  if (loading) {
    return (
      <div className="p-6 text-[#6b7280] sm:p-8">Loading invoices...</div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#f5f5f5]">Invoices</h1>
          <p className="mt-1 text-[13px] text-[#6b7280]">Track billing and payment collection across all clients.</p>
        </div>

        {(role === 'admin' || role === 'bd_intern') && (
          <button
            onClick={openNewInvoice}
            className="inline-flex items-center gap-2 rounded-xl bg-[#a855f7] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#9333ea]"
          >
            <Plus size={14} />
            New Invoice
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {INVOICE_STATUSES.map((status) => {
          const isActive = filterStatus === status
          return (
            <span
              key={status}
              className={`rounded-xl px-3 py-1 text-[12px] ${isActive ? 'bg-[#111111] text-[#f5f5f5]' : 'bg-[#0f0f0f] text-[#71717a]'}`}
            >
              {status}
            </span>
          )
        })}
        <span className={`rounded-xl px-3 py-1 text-[12px] ${filterStatus === 'all' ? 'bg-[#111111] text-[#f5f5f5]' : 'bg-[#0f0f0f] text-[#71717a]'}`}>All</span>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#27272a] bg-[#0c0c0c] p-8 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-[#111111] text-[#6b7280]">
            <ReceiptText size={18} />
          </div>
          <p className="text-[14px] text-[#f5f5f5]">No invoices found</p>
          <p className="mt-1 text-[12px] text-[#6b7280]">Create your first invoice to start tracking payments.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f]">
          <div className="grid grid-cols-[150px_1.6fr_130px_120px_120px_120px] border-b border-[#1f1f1f] bg-[#111111] px-4 py-2 text-[11px] uppercase tracking-widest text-[#71717a]">
            <span>Invoice #</span>
            <span>Client</span>
            <span>Date</span>
            <span>Due</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#1a1a1a]">
            {filteredInvoices.map((invoice) => (
              <button
                key={invoice._id}
                onClick={() => {
                  setShowBuilder(false)
                  setPreviewInvoice(invoice)
                }}
                className="grid w-full grid-cols-[150px_1.6fr_130px_120px_120px_120px] items-center px-4 py-3 text-left transition-colors duration-150 hover:bg-[#121212]"
              >
                <span className="text-[12px] font-medium text-[#d4d4d8]">{invoice.invoiceNumber}</span>
                <div>
                  <p className="text-[13px] text-[#f5f5f5]">{invoice.client.businessName}</p>
                  <p className="text-[12px] text-[#6b7280]">{invoice.client.ownerName}</p>
                </div>
                <span className="text-[12px] text-[#a1a1aa]">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
                <span className="text-[12px] text-[#a1a1aa]">{new Date(invoice.dueDate).toLocaleDateString('en-IN')}</span>
                <span className="text-right text-[12px] font-medium text-[#f5f5f5]">₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] ${statusColors[invoice.status]}`}>{invoice.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showBuilder && (
        <InvoiceBuilder
          role={role}
          sourceInvoice={editInvoice}
          onClose={() => {
            setShowBuilder(false)
            setEditInvoice(null)
          }}
          onSaved={(invoice) => {
            upsertInvoice(invoice)
            setShowBuilder(false)
            setEditInvoice(null)
            setPreviewInvoice(invoice)
          }}
        />
      )}

      {previewInvoice && (
        <InvoicePreview
          role={role}
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          onEdit={() => {
            setPreviewInvoice(null)
            setEditInvoice(previewInvoice)
            setShowBuilder(true)
          }}
          onUpdated={(updated) => {
            upsertInvoice(updated)
            setPreviewInvoice(updated)
          }}
        />
      )}
    </div>
  )
}
