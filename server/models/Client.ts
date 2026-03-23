import { Schema, model, type Document, Types } from 'mongoose'

export const CLIENT_STATUSES = ['Active', 'Onboarding', 'Inactive'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const BUSINESS_TYPES = ['Restaurant', 'Clinic', 'Salon', 'Shop & retail', 'Other'] as const
export type ClientBusinessType = (typeof BUSINESS_TYPES)[number]

export interface IClient extends Document {
  _id: Types.ObjectId
  businessName: string
  ownerName: string
  phone: string
  email?: string
  businessType: ClientBusinessType
  status: ClientStatus
  assignedTo: Types.ObjectId
  website?: string
  address?: string
  services: string[]
  onboardingStartedAt?: Date
  activeFrom?: Date
  contractValue?: number
  notes?: string
  createdBy: Types.ObjectId
  convertedFromLead?: string
  createdAt: Date
  updatedAt: Date
}

const clientSchema = new Schema<IClient>(
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
      enum: BUSINESS_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: CLIENT_STATUSES,
      default: 'Onboarding',
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required'],
      index: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    services: {
      type: [String],
      default: [],
    },
    onboardingStartedAt: {
      type: Date,
    },
    activeFrom: {
      type: Date,
    },
    contractValue: {
      type: Number,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
    convertedFromLead: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

clientSchema.index({ status: 1, assignedTo: 1 })
clientSchema.index({ createdAt: -1 })

export const Client = model<IClient>('Client', clientSchema)
