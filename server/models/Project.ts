import { Schema, model, type Document, Types } from 'mongoose'
import { buildSearchArtifacts } from './search-utils.js'

export const PROJECT_STATUSES = ['In progress', 'Under review', 'Completed', 'On hold'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const SERVICE_TYPES = ['Website build', 'Automation tools', 'UI/UX design'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export interface IProjectTask {
  _id: Types.ObjectId
  title: string
  isDone: boolean
  assignedTo?: Types.ObjectId
  dueDate?: Date
  createdAt: Date
}

export interface IProject extends Document {
  _id: Types.ObjectId
  title: string
  description?: string
  client: Types.ObjectId
  serviceType: ServiceType
  status: ProjectStatus
  assignedTo: Types.ObjectId[]
  startDate?: Date
  dueDate?: Date
  completedAt?: Date
  priority: 'low' | 'medium' | 'high'
  progress: number
  tasks: IProjectTask[]
  notes?: string
  searchText: string
  searchPrefixes: string[]
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const projectTaskSchema = new Schema<IProjectTask>(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    isDone: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dueDate: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: true }
)

const projectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required'],
      index: true,
    },
    serviceType: {
      type: String,
      enum: SERVICE_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'In progress',
      index: true,
    },
    assignedTo: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: (value: Types.ObjectId[]) => Array.isArray(value) && value.length > 0,
        message: 'At least one assignee is required',
      },
    },
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    tasks: {
      type: [projectTaskSchema],
      default: [],
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

projectSchema.index({ status: 1, serviceType: 1 })
projectSchema.index({ createdAt: -1 })
projectSchema.index({ searchPrefixes: 1, createdBy: 1 })
projectSchema.index({ searchPrefixes: 1, assignedTo: 1 })

projectSchema.pre('save', function () {
  const artifacts = buildSearchArtifacts([
    this.title,
    this.description,
    this.serviceType,
    this.status,
    this.notes,
    this.tasks?.map((task) => task.title).join(' '),
  ])
  this.searchText = artifacts.searchText
  this.searchPrefixes = artifacts.searchPrefixes
})

export const Project = model<IProject>('Project', projectSchema)
