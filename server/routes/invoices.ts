import { Router, type Response } from 'express'
import { Types } from 'mongoose'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Client } from '../models/Client.js'
import { InvoiceModel } from '../models/Invoice.js'
import { getAuthContext, isAdmin } from './_helpers.js'

const router = Router()
router.use(authenticateToken)

const GST_RATE = 0.18

function canEdit(roleName: string) {
  return roleName === 'admin' || roleName === 'bd_intern'
}

function serializeInvoice(invoice: any) {
  return {
    _id: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    client: {
      _id: String(invoice.clientId?._id ?? invoice.clientId ?? ''),
      businessName: invoice.clientId?.businessName ?? 'Unknown Client',
      ownerName: invoice.clientId?.ownerName ?? '',
      phone: invoice.clientId?.phone ?? '',
      email: invoice.clientId?.email ?? '',
      address: invoice.clientId?.address ?? '',
    },
    lineItems: invoice.lineItems ?? [],
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal,
    gstEnabled: invoice.gstEnabled,
    gstAmount: invoice.gstAmount,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    notes: invoice.notes,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  }
}

function computeTotals(
  lineItems: Array<{ qty: number; rate: number; amount?: number }>,
  gstEnabled: boolean,
): { subtotal: number; gstAmount: number; totalAmount: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0)
  const gstAmount = gstEnabled ? subtotal * GST_RATE : 0
  const totalAmount = subtotal + gstAmount

  return {
    subtotal: Number(subtotal.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  }
}

async function nextInvoiceNumber() {
  const latest = await InvoiceModel.findOne().sort({ createdAt: -1 }).select('invoiceNumber')
  if (!latest?.invoiceNumber) return 'INV-0001'

  const suffix = Number.parseInt(latest.invoiceNumber.replace(/[^0-9]/g, ''), 10)
  const next = Number.isNaN(suffix) ? 1 : suffix + 1
  return `INV-${String(next).padStart(4, '0')}`
}

function normalizeLineItems(
  lineItems: Array<{ id?: string; description?: string; subDescription?: string; qty?: number; rate?: number; amount?: number }>,
) {
  return lineItems
    .map((item, idx) => {
      const qty = Number(item.qty || 0)
      const rate = Number(item.rate || 0)
      const description = String(item.description || '').trim()
      const subDescription = String(item.subDescription || '').trim()

      return {
        id: String(item.id || `line-${idx + 1}`),
        description,
        subDescription,
        qty,
        rate,
        amount: Number((qty * rate).toFixed(2)),
      }
    })
    .filter((item) => item.description && item.qty > 0)
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const query = isAdmin(auth.roleName) ? {} : { createdBy: auth.userId }

    const invoices = await InvoiceModel.find(query)
      .populate('clientId', 'businessName ownerName phone email address')
      .sort({ createdAt: -1 })

    return res.json({
      invoices: invoices.map((invoice) => serializeInvoice(invoice)),
      total: invoices.length,
    })
  } catch (error) {
    console.error('Invoices list error:', error)
    return res.status(500).json({ error: 'Failed to fetch invoices' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!canEdit(auth.roleName)) return res.status(403).json({ error: 'Not allowed to create invoices' })

    const { clientId, lineItems, invoiceDate, dueDate, gstEnabled = true, notes = '' } = req.body as {
      clientId?: string
      lineItems?: Array<{ id?: string; description?: string; subDescription?: string; qty?: number; rate?: number; amount?: number }>
      invoiceDate?: string
      dueDate?: string
      gstEnabled?: boolean
      notes?: string
    }

    if (!clientId || !Array.isArray(lineItems) || lineItems.length === 0 || !invoiceDate || !dueDate) {
      return res.status(400).json({ error: 'clientId, lineItems, invoiceDate and dueDate are required' })
    }

    if (!Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ error: 'Invalid client id' })
    }

    const client = await Client.findById(clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const normalizedItems = normalizeLineItems(lineItems)
    if (!normalizedItems.length) {
      return res.status(400).json({ error: 'Add at least one valid line item' })
    }

    const totals = computeTotals(normalizedItems, Boolean(gstEnabled))

    const created = await InvoiceModel.create({
      invoiceNumber: await nextInvoiceNumber(),
      clientId,
      lineItems: normalizedItems,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      subtotal: totals.subtotal,
      gstEnabled: Boolean(gstEnabled),
      gstAmount: totals.gstAmount,
      totalAmount: totals.totalAmount,
      status: 'Unpaid',
      notes: String(notes || '').trim(),
      createdBy: auth.userId,
    })

    const populated = await InvoiceModel.findById(created._id).populate('clientId', 'businessName ownerName phone email address')

    return res.status(201).json({ invoice: serializeInvoice(populated) })
  } catch (error) {
    console.error('Create invoice error:', error)
    return res.status(500).json({ error: 'Failed to create invoice' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!canEdit(auth.roleName)) return res.status(403).json({ error: 'Not allowed to update invoices' })

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid invoice id' })
    }

    const invoice = await InvoiceModel.findById(id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    if (!isAdmin(auth.roleName) && invoice.createdBy.toString() !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to edit this invoice' })
    }

    const { clientId, lineItems, invoiceDate, dueDate, gstEnabled = true, notes = '' } = req.body as {
      clientId?: string
      lineItems?: Array<{ id?: string; description?: string; subDescription?: string; qty?: number; rate?: number; amount?: number }>
      invoiceDate?: string
      dueDate?: string
      gstEnabled?: boolean
      notes?: string
    }

    if (!clientId || !Array.isArray(lineItems) || lineItems.length === 0 || !invoiceDate || !dueDate) {
      return res.status(400).json({ error: 'clientId, lineItems, invoiceDate and dueDate are required' })
    }

    if (!Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ error: 'Invalid client id' })
    }

    const client = await Client.findById(clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const normalizedItems = normalizeLineItems(lineItems)
    if (!normalizedItems.length) {
      return res.status(400).json({ error: 'Add at least one valid line item' })
    }

    const totals = computeTotals(normalizedItems, Boolean(gstEnabled))

    invoice.clientId = new Types.ObjectId(clientId)
    invoice.lineItems = normalizedItems
    invoice.invoiceDate = new Date(invoiceDate)
    invoice.dueDate = new Date(dueDate)
    invoice.subtotal = totals.subtotal
    invoice.gstEnabled = Boolean(gstEnabled)
    invoice.gstAmount = totals.gstAmount
    invoice.totalAmount = totals.totalAmount
    invoice.notes = String(notes || '').trim()

    await invoice.save()

    const populated = await InvoiceModel.findById(invoice._id).populate('clientId', 'businessName ownerName phone email address')

    return res.json({ invoice: serializeInvoice(populated) })
  } catch (error) {
    console.error('Update invoice error:', error)
    return res.status(500).json({ error: 'Failed to update invoice' })
  }
})

router.patch('/:id/paid', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can mark invoices as paid' })

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid invoice id' })

    const invoice = await InvoiceModel.findById(id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    invoice.status = 'Paid'
    await invoice.save()

    const populated = await InvoiceModel.findById(invoice._id).populate('clientId', 'businessName ownerName phone email address')
    return res.json({ invoice: serializeInvoice(populated) })
  } catch (error) {
    console.error('Mark invoice paid error:', error)
    return res.status(500).json({ error: 'Failed to update invoice status' })
  }
})

router.patch('/:id/overdue', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can mark invoices as overdue' })

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid invoice id' })

    const invoice = await InvoiceModel.findById(id)
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    invoice.status = 'Overdue'
    await invoice.save()

    const populated = await InvoiceModel.findById(invoice._id).populate('clientId', 'businessName ownerName phone email address')
    return res.json({ invoice: serializeInvoice(populated) })
  } catch (error) {
    console.error('Mark invoice overdue error:', error)
    return res.status(500).json({ error: 'Failed to update invoice status' })
  }
})

export { router as invoicesRouter }
