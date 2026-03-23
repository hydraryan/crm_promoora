import { Schema, model, type Document, Types } from 'mongoose'

export const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Awaiting response', 'Accepted', 'Rejected'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export interface IProposalServiceBlock {
  id: string
  serviceKey: string
  title: string
  description: string
  deliverables: string[]
}

export interface IProposalMilestone {
  id: string
  title: string
  duration: string
  description?: string
}

export interface IProposal extends Document {
  _id: Types.ObjectId
  proposalNumber: string
  title: string
  status: ProposalStatus
  leadId?: Types.ObjectId
  clientId?: Types.ObjectId
  targetType: 'lead' | 'client'
  serviceBlocks: IProposalServiceBlock[]
  milestones: IProposalMilestone[]
  notes?: string
  createdBy: Types.ObjectId
  sentAt?: Date
  acceptedAt?: Date
  rejectedAt?: Date
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
}

const serviceBlockSchema = new Schema<IProposalServiceBlock>(
  {
    id: { type: String, required: true },
    serviceKey: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    deliverables: { type: [String], default: [] },
  },
  { _id: false }
)

const milestoneSchema = new Schema<IProposalMilestone>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
)

const proposalSchema = new Schema<IProposal>(
  {
    proposalNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: PROPOSAL_STATUSES,
      default: 'Draft',
      index: true,
    },
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
      required: true,
      index: true,
    },
    serviceBlocks: {
      type: [serviceBlockSchema],
      default: [],
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
    },
    acceptedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

proposalSchema.index({ status: 1, createdAt: -1 })
proposalSchema.index({ createdBy: 1, createdAt: -1 })

export const Proposal = model<IProposal>('Proposal', proposalSchema)
