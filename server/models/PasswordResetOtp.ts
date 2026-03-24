import { Schema, model, type Document } from 'mongoose'

export interface IPasswordResetOtp extends Document {
  email: string
  otpHash: string
  expiresAt: Date
  usedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const passwordResetOtpSchema = new Schema<IPasswordResetOtp>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: [true, 'OTP hash is required'],
      trim: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry is required'],
      index: true,
    },
    usedAt: {
      type: Date,
      default: undefined,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

passwordResetOtpSchema.index({ email: 1, createdAt: -1 })

export const PasswordResetOtp = model<IPasswordResetOtp>('PasswordResetOtp', passwordResetOtpSchema)