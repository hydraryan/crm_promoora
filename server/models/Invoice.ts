import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const invoiceLineItemSchema = new Schema(
  {
    id: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    subDescription: { type: String, default: '', trim: true },
    qty: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, trim: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    lineItems: { type: [invoiceLineItemSchema], required: true },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    gstEnabled: { type: Boolean, default: true },
    gstAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Unpaid', 'Paid', 'Overdue'], default: 'Unpaid', index: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
  },
)

invoiceSchema.index({ createdAt: -1 })

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema>

export const InvoiceModel = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema)
