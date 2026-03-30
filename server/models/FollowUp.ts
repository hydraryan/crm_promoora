import { Schema, model, type Document, Types } from 'mongoose'
import { buildSearchArtifacts } from './search-utils.js'

export type FollowUpType = 'Phone call' | 'Walk-in' | 'WhatsApp' | 'call' | 'walk-in' | 'whatsapp'
export type FollowUpTargetType = 'lead' | 'client'

export interface IFollowUp extends Document {
  _id: Types.ObjectId
  leadId?: Types.ObjectId
  clientId?: Types.ObjectId
  targetType: FollowUpTargetType
  businessName: string
  ownerName: string
  type: FollowUpType
  note?: string
  searchText: string
  searchPrefixes: string[]
  assignedTo: Types.ObjectId
  dueAt: Date
  isDone: boolean
  doneAt?: Date
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const followUpSchema = new Schema<IFollowUp>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    targetType: {
      type: String,
      enum: ['lead', 'client'],
      default: 'lead',
      index: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['Phone call', 'Walk-in', 'WhatsApp', 'call', 'walk-in', 'whatsapp'],
      required: [true, 'Follow-up type is required'],
      index: true,
    },
    note: {
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
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned user is required'],
      index: true,
    },
    dueAt: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    isDone: {
      type: Boolean,
      default: false,
      index: true,
    },
    doneAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

followUpSchema.index({ assignedTo: 1, dueAt: 1, isDone: 1 })
followUpSchema.index({ targetType: 1, leadId: 1, clientId: 1 })
followUpSchema.index({ searchPrefixes: 1, assignedTo: 1 })
followUpSchema.index({ isDone: 1, dueAt: -1 })
followUpSchema.index({ isDone: 1, doneAt: -1 })

followUpSchema.pre('save', function () {
  const artifacts = buildSearchArtifacts([this.businessName, this.ownerName, this.note, this.type])
  this.searchText = artifacts.searchText
  this.searchPrefixes = artifacts.searchPrefixes
})

export const FollowUp = model<IFollowUp>('FollowUp', followUpSchema)
