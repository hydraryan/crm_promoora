import { Schema, model, type Document, Types } from 'mongoose'

export type ProspectorProvider = 'google-maps' | 'justdial' | 'indiamart'
export type ProspectorStatus = 'pending' | 'completed' | 'failed'
export type FootfallBand = 'low' | 'medium' | 'high'
export type ConfidenceBand = 'low' | 'medium' | 'high'

export interface IProspectorCandidate {
  candidateId: string
  source: ProspectorProvider
  placeId?: string
  name: string
  address?: string
  formattedAddress?: string
  phone?: string
  website?: string
  placeUrl?: string
  category?: string
  primaryType?: string
  rating?: number
  reviewCount: number
  latestReviewAt?: Date
  isActive: boolean
  activeScore: number
  footfallBand: FootfallBand
  footfallDailyMin: number
  footfallDailyMax: number
  footfallWeeklyMin: number
  footfallWeeklyMax: number
  confidence: ConfidenceBand
  signals: string[]
  openingHours?: string[]
}

export interface IProspectorProviderError {
  source: ProspectorProvider
  message: string
}

export interface IProspectorFilters {
  minReviews: number
  recencyDays: number
  maxResults: number
  onlyNoWebsite?: boolean
}

export interface IProspectorJob extends Document {
  _id: Types.ObjectId
  query: string
  status: ProspectorStatus
  filters: IProspectorFilters
  providers: ProspectorProvider[]
  providerErrors: IProspectorProviderError[]
  candidates: IProspectorCandidate[]
  createdBy: Types.ObjectId
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const prospectorCandidateSchema = new Schema<IProspectorCandidate>(
  {
    candidateId: { type: String, required: true, trim: true },
    source: { type: String, enum: ['google-maps', 'justdial', 'indiamart'], required: true },
    placeId: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    formattedAddress: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    placeUrl: { type: String, trim: true },
    category: { type: String, trim: true },
    primaryType: { type: String, trim: true },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    latestReviewAt: { type: Date },
    isActive: { type: Boolean, default: false },
    activeScore: { type: Number, default: 0 },
    footfallBand: { type: String, enum: ['low', 'medium', 'high'], required: true },
    footfallDailyMin: { type: Number, min: 0, required: true },
    footfallDailyMax: { type: Number, min: 0, required: true },
    footfallWeeklyMin: { type: Number, min: 0, required: true },
    footfallWeeklyMax: { type: Number, min: 0, required: true },
    confidence: { type: String, enum: ['low', 'medium', 'high'], required: true },
    signals: { type: [String], default: [] },
    openingHours: { type: [String], default: [] },
  },
  { _id: false }
)

const prospectorProviderErrorSchema = new Schema<IProspectorProviderError>(
  {
    source: { type: String, enum: ['google-maps', 'justdial', 'indiamart'], required: true },
    message: { type: String, required: true, trim: true },
  },
  { _id: false }
)

const prospectorJobSchema = new Schema<IProspectorJob>(
  {
    query: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    filters: {
      minReviews: { type: Number, required: true, default: 200, min: 0 },
      recencyDays: { type: Number, required: true, default: 30, min: 1 },
      maxResults: { type: Number, required: true, default: 25, min: 1, max: 200 },
      onlyNoWebsite: { type: Boolean, default: false },
    },
    providers: {
      type: [String],
      enum: ['google-maps', 'justdial', 'indiamart'],
      default: ['google-maps', 'justdial', 'indiamart'],
    },
    providerErrors: { type: [prospectorProviderErrorSchema], default: [] },
    candidates: { type: [prospectorCandidateSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
)

prospectorJobSchema.index({ createdBy: 1, createdAt: -1 })
prospectorJobSchema.index({ status: 1, createdAt: -1 })

export const ProspectorJob = model<IProspectorJob>('ProspectorJob', prospectorJobSchema)