export const INVOICE_STATUSES = ['Unpaid', 'Paid', 'Overdue'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const statusColors: Record<InvoiceStatus, string> = {
  Unpaid: '#f59e0b',
  Paid: '#22c55e',
  Overdue: '#ef4444',
}

export interface InvoiceLineItem {
  id: string
  description: string
  subDescription?: string
  qty: number
  rate: number
  amount: number
}

export interface Invoice {
  _id: string
  invoiceNumber: string
  status: InvoiceStatus
  client: {
    _id: string
    businessName: string
    ownerName: string
    phone: string
    email?: string
    address?: string
  }
  lineItems: InvoiceLineItem[]
  subtotal: number
  gstEnabled: boolean
  gstAmount: number
  totalAmount: number
  invoiceDate: string
  dueDate: string
  notes?: string
  createdBy: { _id: string; name: string; initials: string }
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export function computeTotals(items: InvoiceLineItem[], gstEnabled: boolean) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.rate, 0)
  const gstAmount = gstEnabled ? Math.round(subtotal * 0.18) : 0
  const totalAmount = subtotal + gstAmount
  return { subtotal, gstAmount, totalAmount }
}

export function formatINR(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN')
}
