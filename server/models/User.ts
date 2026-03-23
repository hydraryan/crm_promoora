import { Schema, model, Document, Types } from 'mongoose'

export interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  email: string
  passwordHash: string
  phone?: string
  avatarInitials?: string
  roleId: Types.ObjectId
  status: 'active' | 'inactive' | 'suspended'
  isEmailVerified: boolean
  lastLoginAt?: Date
  passwordChangedAt?: Date
  createdBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      minlength: 60, // bcrypt hash length
      select: false, // Don't return by default
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined for unique index
    },
    avatarInitials: {
      type: String,
      default: function (this: IUser) {
        // Auto-derive from name e.g., "AS" for "Admin Staff"
        return this.name
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase())
          .join('')
          .slice(0, 2)
      },
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Role is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'inactive',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Admin trail
    },
  },
  {
    timestamps: true, // Auto-adds createdAt and updatedAt
  }
)

// Index for common queries
userSchema.index({ email: 1, status: 1 })

// Pre-save middleware to hash password (if not already hashed)
// TODO: Implement bcrypt hashing in auth routes during backend setup
// userSchema.pre('save', async function (this: IUser, next: Function) {
//   if (!this.isModified('passwordHash')) {
//     return next()
//   }
//
//   // In production, use bcrypt here
//   // const salt = await bcrypt.genSalt(10)
//   // this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
//
//   next()
// })

export const User = model<IUser>('User', userSchema)
