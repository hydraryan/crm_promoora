import { Schema, model, type Document, Types } from 'mongoose'
import { buildSearchArtifacts } from './search-utils.js'

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
  sourceProvider?: 'google-maps' | 'justdial' | 'indiamart'
  sourcePlaceId?: string
  sourcePlaceUrl?: string
  sourceWebsite?: string
  sourcePhone?: string
  sourceAddress?: string
  sourceCategory?: string
  sourceOpeningHours?: string[]
  businessType: BusinessType
  stage: LeadStage
  source?: 'walk_in' | 'referral' | 'instagram' | 'cold_call' | 'other'
  notes?: string
  searchText: string
  searchPrefixes: string[]
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
    sourceProvider: {
      type: String,
      enum: ['google-maps', 'justdial', 'indiamart'],
    },
    sourcePlaceId: {
      type: String,
      trim: true,
      index: true,
    },
    sourcePlaceUrl: {
      type: String,
      trim: true,
    },
    sourceWebsite: {
      type: String,
      trim: true,
    },
    sourcePhone: {
      type: String,
      trim: true,
    },
    sourceAddress: {
      type: String,
      trim: true,
    },
    sourceCategory: {
      type: String,
      trim: true,
    },
    sourceOpeningHours: {
      type: [String],
      default: [],
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
    searchText: {
      type: String,
      default: '',
      index: true,
    },
    searchPrefixes: {
      type: [String],
      default: [],
      index: true,
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
leadSchema.index({ searchPrefixes: 1, assignedTo: 1 })
leadSchema.index({ searchPrefixes: 1, createdBy: 1 })
leadSchema.index({ assignedTo: 1, stage: 1, updatedAt: -1 })
leadSchema.index({ createdAt: -1, stage: 1 })
leadSchema.index({ updatedAt: -1, stage: 1 })
leadSchema.index({ sourcePlaceId: 1, createdBy: 1 })

leadSchema.pre('save', function () {
  const artifacts = buildSearchArtifacts([this.businessName, this.ownerName, this.phone, this.email, this.notes])
  this.searchText = artifacts.searchText
  this.searchPrefixes = artifacts.searchPrefixes
})

export const Lead = model<ILead>('Lead', leadSchema)
