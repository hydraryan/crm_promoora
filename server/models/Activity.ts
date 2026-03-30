import { Schema, model, type Document, Types } from 'mongoose'

export type ActivityType =
  | 'note'
  | 'lead_created'
  | 'proposal_sent'
  | 'invoice_sent'
  | 'lead_stage_changed'
  | 'stage_changed'
  | 'followup_done'
  | 'client_added'

export type ActivityOutcome = 'positive' | 'neutral' | 'follow-up needed'

export interface ActivityMeta {
  followupType?: string
  fromStage?: string
  toStage?: string
  proposalNumber?: string
  invoiceNumber?: string
}

export interface IActivity extends Document {
  _id: Types.ObjectId
  actor: Types.ObjectId
  type: ActivityType
  description: string
  targetName: string
  targetId: string
  targetType?: 'lead' | 'client'
  outcome?: ActivityOutcome | null
  meta?: ActivityMeta
  createdAt: Date
  updatedAt: Date
}

const activitySchema = new Schema<IActivity>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['note', 'lead_created', 'proposal_sent', 'invoice_sent', 'lead_stage_changed', 'stage_changed', 'followup_done', 'client_added'],
      required: [true, 'Activity type is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    targetName: {
      type: String,
      required: [true, 'Target name is required'],
      trim: true,
      index: true,
    },
    targetId: {
      type: String,
      required: [true, 'Target id is required'],
      trim: true,
    },
    targetType: {
      type: String,
      enum: ['lead', 'client'],
      required: false,
      index: true,
    },
    outcome: {
      type: String,
      enum: ['positive', 'neutral', 'follow-up needed'],
      default: null,
    },
    meta: {
      followupType: { type: String, required: false },
      fromStage: { type: String, required: false },
      toStage: { type: String, required: false },
      proposalNumber: { type: String, required: false },
      invoiceNumber: { type: String, required: false },
    },
  },
  {
    timestamps: true,
  }
)

activitySchema.index({ createdAt: -1, actor: 1 })
activitySchema.index({ actor: 1, type: 1, createdAt: -1 })
activitySchema.index({ actor: 1, createdAt: -1 })

export const Activity = model<IActivity>('Activity', activitySchema)
