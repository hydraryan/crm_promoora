import { Schema, model, Document, Types } from 'mongoose'

export interface IRole extends Document {
  _id: Types.ObjectId
  name: string
  label: string
  color?: string
  permissions: {
    leads: string[]
    clients: string[]
    projects: string[]
    followups: string[]
    proposals: string[]
    invoices: string[]
    invoicing: string[]
    communication: string[]
    reports: string[]
    team: string[]
    settings: string[]
  }
  disabledModules: string[]
  isSystemRole: boolean
  createdAt: Date
  updatedAt: Date
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: [true, 'Display label is required'],
    },
    color: {
      type: String,
      default: function (this: IRole) {
        const palette: Record<string, string> = {
          admin: '#6366f1',
          bd_intern: '#f59e0b',
          tech_intern: '#22c55e',
          viewer: '#52525b',
        }
        return palette[this.name] ?? '#6366f1'
      },
    },
    permissions: {
      type: {
        leads: [String],
        clients: [String],
        projects: [String],
        followups: [String],
        proposals: [String],
        invoices: [String],
        invoicing: [String],
        communication: [String],
        reports: [String],
        team: [String],
        settings: [String],
      },
      required: true,
      default: {
        leads: [],
        clients: [],
        projects: [],
        followups: [],
        proposals: [],
        invoices: [],
        invoicing: [],
        communication: [],
        reports: [],
        team: [],
        settings: [],
      },
    },
    disabledModules: {
      type: [String],
      default: [],
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

export const Role = model<IRole>('Role', roleSchema)
