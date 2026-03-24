import { Schema, model, type Document, Types } from 'mongoose'

export type NotificationCategory = 'lead' | 'followup' | 'team' | 'system'

export interface INotification extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  category: NotificationCategory
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    category: {
      type: String,
      enum: ['lead', 'followup', 'team', 'system'],
      default: 'system',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })

export const Notification = model<INotification>('Notification', notificationSchema)