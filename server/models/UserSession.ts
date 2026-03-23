import { Schema, model, Document, Types } from 'mongoose'

export interface IUserSession extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  refreshTokenHash: string
  userAgent: string
  deviceId: string
  loginAt: Date
  logoutAt?: Date
  ipAddress?: string
  lastActiveAt?: Date
  expiresAt: Date
  createdAt: Date
}

const userSessionSchema = new Schema<IUserSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: [true, 'Refresh token hash is required'],
    },
    userAgent: {
      type: String,
      required: [true, 'User-agent is required for active sessions UI'],
    },
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
    },
    loginAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    logoutAt: {
      type: Date,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    lastActiveAt: {
      type: Date,
      default: () => new Date(),
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB auto-deletes expired docs
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for efficient lookups
userSessionSchema.index({ userId: 1, deviceId: 1 })
userSessionSchema.index({ userId: 1, loginAt: 1 })

export const UserSession = model<IUserSession>('UserSession', userSessionSchema)
