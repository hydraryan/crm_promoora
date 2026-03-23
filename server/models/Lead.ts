import { Schema, model, type Document, Types } from 'mongoose'

export type LeadStage =
  | 'Cold'
  | 'Contacted'
  | 'Meeting'
  | 'Proposal sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'

export type BusinessType = 'restaurant' | 'clinic' | 'salon' | 'shop' | 'other'

export interface ILead extends Document {
  _id: Types.ObjectId
  businessName: string
  ownerName: string
  phone: string
  email?: string
  businessType: BusinessType
  stage: LeadStage
  source?: 'walk_in' | 'referral' | 'instagram' | 'cold_call' | 'other'
  notes?: string
  nextFollowupAt?: Date
  assignedTo: Types.ObjectId
  createdBy: Types.ObjectId
  lastActivityAt: Date
  createdAt: Date
  updatedAt: Date
}

const leadSchema = new Schema<ILead>(
  {
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    businessType: {
      type: String,
      enum: ['restaurant', 'clinic', 'salon', 'shop', 'other'],
      default: 'other',
      index: true,
    },
    stage: {
      type: String,
      enum: ['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation', 'Won', 'Lost'],
      default: 'Cold',
      index: true,
    },
    source: {
      type: String,
      enum: ['walk_in', 'referral', 'instagram', 'cold_call', 'other'],
    },
    notes: {
      type: String,
      trim: true,
    },
    nextFollowupAt: {
      type: Date,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required'],
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

leadSchema.index({ stage: 1, assignedTo: 1 })
leadSchema.index({ createdAt: -1 })

export const Lead = model<ILead>('Lead', leadSchema)
