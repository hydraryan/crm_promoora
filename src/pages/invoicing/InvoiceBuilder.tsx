import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { computeTotals, formatINR, type Invoice, type InvoiceLineItem } from '@/utils/invoiceConstants'

type ClientLite = {
  _id: string
  businessName: string
  ownerName: string
  phone: string
  email?: string
  address?: string
}

interface InvoiceBuilderProps {
  role: string
  sourceInvoice?: Invoice | null
  onClose: () => void
  onSaved: (invoice: Invoice) => void
}

function createLineItem(): InvoiceLineItem {
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return {
    id,
    description: '',
    subDescription: '',
    qty: 1,
    rate: 0,
    amount: 0,
  }
}

export default function InvoiceBuilder({ role, sourceInvoice, onClose, onSaved }: InvoiceBuilderProps) {
  const [clients, setClients] = useState<ClientLite[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [saving, setSaving] = useState(false)

  const [clientId, setClientId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([createLineItem()])
  const [gstEnabled, setGstEnabled] = useState(true)
  const [notes, setNotes] = useState('')

  const isEdit = Boolean(sourceInvoice?._id)

  useEffect(() => {
    let active = true

    async function loadClients() {
      try {
        const response = await apiFetch<{ clients: ClientLite[] }>('/clients')
        if (!active) return
        setClients(response.clients || [])
      } finally {
        if (active) {
          setLoadingClients(false)
        }
      }
    }

    loadClients()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!sourceInvoice) {
      return
    }

    setClientId(sourceInvoice.client?._id || '')
    setInvoiceDate(sourceInvoice.invoiceDate ? new Date(sourceInvoice.invoiceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    setDueDate(sourceInvoice.dueDate ? new Date(sourceInvoice.dueDate).toISOString().slice(0, 10) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    setLineItems(
      sourceInvoice.lineItems.length
        ? sourceInvoice.lineItems.map((item) => ({
            ...item,
            id: item.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
          }))
        : [createLineItem()],
    )
    setGstEnabled(sourceInvoice.gstEnabled)
    setNotes(sourceInvoice.notes || '')
  }, [sourceInvoice])

  const recalculatedItems = useMemo(
    () =>
      lineItems.map((item) => ({
        ...item,
        amount: Number(item.qty || 0) * Number(item.rate || 0),
      })),
    [lineItems],
  )

  const totals = useMemo(() => computeTotals(recalculatedItems, gstEnabled), [recalculatedItems, gstEnabled])

  function updateLineItem(id: string, field: keyof InvoiceLineItem, value: string | number) {
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item
        const updated: InvoiceLineItem = { ...item, [field]: value } as InvoiceLineItem
        updated.amount = Number(updated.qty || 0) * Number(updated.rate || 0)
        return updated
      }),
    )
  }

  function addLineItem() {
    setLineItems((current) => [...current, createLineItem()])
  }

  function removeLineItem(id: string) {
    setLineItems((current) => {
      if (current.length === 1) return current
      return current.filter((item) => item.id !== id)
    })
  }

  async function handleSubmit() {
    if (!clientId) {
      alert('Please select a client.')
      return
    }

    const cleaned = recalculatedItems
      .map((item) => ({
        ...item,
        description: item.description.trim(),
        subDescription: item.subDescription?.trim() || '',
      }))
      .filter((item) => item.description && item.qty > 0)

    if (!cleaned.length) {
      alert('Add at least one valid line item.')
      return
    }

    const payload = {
      clientId,
      invoiceDate,
      dueDate,
      lineItems: cleaned,
      gstEnabled,
      notes: notes.trim(),
    }

    setSaving(true)
    try {
      if (isEdit && sourceInvoice?._id) {
        const response = await apiFetch<{ invoice: Invoice }>(`/invoices/${sourceInvoice._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        onSaved(response.invoice)
      } else {
        const response = await apiFetch<{ invoice: Invoice }>('/invoices', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        onSaved(response.invoice)
      }
    } finally {
      setSaving(false)
    }
  }

  if (role !== 'admin' && role !== 'bd_intern') {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0a] p-4 sm:p-8">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#111111]">
              <ArrowLeft size={15} />
            </button>
            <div>
              <h2 className="text-[17px] font-medium text-[#f5f5f5]">{isEdit ? 'Edit invoice' : 'New invoice'}</h2>
              <p className="text-[12px] text-[#6b7280]">Create a clean invoice for your client with GST support.</p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-xl bg-[#a855f7] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#9333ea] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : isEdit ? 'Update invoice' : 'Save invoice'}
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_310px]">
          <div className="space-y-6 p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#6b7280]">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={loadingClients}
                  className="w-full rounded-xl border border-[#27272a] bg-[#101010] px-3 py-2.5 text-[13px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition focus:ring"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.businessName} - {client.ownerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#6b7280]">Invoice date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-[#27272a] bg-[#101010] px-3 py-2.5 text-[13px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition focus:ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#6b7280]">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#27272a] bg-[#101010] px-3 py-2.5 text-[13px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition focus:ring"
                />
              </div>

              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#27272a] bg-[#101010] px-3 py-2.5 text-[13px] text-[#d4d4d8]">
                  <input type="checkbox" className="accent-[#a855f7]" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
                  Include GST (18%)
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-medium text-[#e4e4e7]">Line Items</h3>
                <button onClick={addLineItem} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111111] px-3 py-1.5 text-[12px] text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1a1a1a]">
                  <Plus size={13} />
                  Add item
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#1f1f1f]">
                <div className="grid grid-cols-[1.4fr_1.3fr_90px_130px_130px_48px] border-b border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[11px] uppercase tracking-widest text-[#71717a]">
                  <span>Description</span>
                  <span>Sub Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>

                <div className="divide-y divide-[#1a1a1a]">
                  {lineItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1.4fr_1.3fr_90px_130px_130px_48px] gap-2 px-3 py-2">
                      <input
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Service description"
                        className="w-full rounded-lg border border-[#27272a] bg-[#0f0f0f] px-2.5 py-2 text-[12px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition placeholder:text-[#52525b] focus:ring"
                      />
                      <input
                        value={item.subDescription || ''}
                        onChange={(e) => updateLineItem(item.id, 'subDescription', e.target.value)}
                        placeholder="Optional note"
                        className="w-full rounded-lg border border-[#27272a] bg-[#0f0f0f] px-2.5 py-2 text-[12px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition placeholder:text-[#52525b] focus:ring"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateLineItem(item.id, 'qty', Number(e.target.value || 0))}
                        className="w-full rounded-lg border border-[#27272a] bg-[#0f0f0f] px-2.5 py-2 text-right text-[12px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition focus:ring"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.rate}
                        onChange={(e) => updateLineItem(item.id, 'rate', Number(e.target.value || 0))}
                        className="w-full rounded-lg border border-[#27272a] bg-[#0f0f0f] px-2.5 py-2 text-right text-[12px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition focus:ring"
                      />
                      <div className="flex items-center justify-end px-2 text-[12px] font-medium text-[#d4d4d8]">{formatINR(Number(item.qty || 0) * Number(item.rate || 0))}</div>
                      <button
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                        className="flex size-8 items-center justify-center rounded-lg text-[#71717a] transition-colors duration-150 hover:bg-[#171717] hover:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[#6b7280]">Notes</label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional payment note, instructions, or terms"
                className="w-full rounded-xl border border-[#27272a] bg-[#101010] px-3 py-2.5 text-[13px] text-[#f5f5f5] outline-none ring-[#a855f7]/45 transition placeholder:text-[#52525b] focus:ring"
              />
            </div>
          </div>

          <aside className="border-t border-[#1a1a1a] bg-[#0f0f0f] p-5 lg:border-t-0 lg:border-l lg:border-l-[#1a1a1a] sm:p-7">
            <h3 className="text-[13px] font-medium text-[#e4e4e7]">Summary</h3>
            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[#71717a]">Subtotal</span>
                <span className="font-medium text-[#e4e4e7]">{formatINR(totals.subtotal)}</span>
              </div>
              {gstEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a]">GST (18%)</span>
                  <span className="font-medium text-[#d8b4fe]">{formatINR(totals.gstAmount)}</span>
                </div>
              )}
              <div className="mt-1 border-t border-[#1f1f1f] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[#fafafa]">Total</span>
                  <span className="text-[16px] font-semibold text-[#fafafa]">{formatINR(totals.totalAmount)}</span>
                </div>
              </div>
            </div>

            <p className="mt-6 text-[12px] leading-relaxed text-[#6b7280]">
              Invoices are created with status <span className="text-[#f5f5f5]">Unpaid</span>. Use the preview screen to mark them as paid or overdue.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
