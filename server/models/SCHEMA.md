# MongoDB Schema Documentation

## Users Collection

Stores user account information with role-based access control.

### Fields

| Field | Type | Flags | Notes |
|-------|------|-------|-------|
| `_id` | ObjectId | auto | Primary key |
| `name` | String | required | Full name |
| `email` | String | required, unique, indexed | Login identifier, low-case trimmed |
| `passwordHash` | String | required | Bcrypt hash — never store plain text |
| `phone` | String | unique, sparse | Optional, for WhatsApp comms |
| `avatarInitials` | String | default | Auto-derived from name e.g. "AS" |
| `roleId` | ObjectId | required, FK→roles | Reference to roles collection |
| `status` | String | enum: active\|inactive\|suspended | default: inactive |
| `isEmailVerified` | Boolean | default: false | For email verification flow |
| `lastLoginAt` | Date | | Updated on every login |
| `passwordChangedAt` | Date | | Track password change history |
| `createdBy` | ObjectId | FK→users | Admin trail |
| `createdAt` | Date | timestamps | Mongoose auto |
| `updatedAt` | Date | timestamps | Mongoose auto |

### Indices

- `{ email: 1, status: 1 }` — Query active users by email
- `{ roleId: 1 }` — Fetch users by role

---

## Roles Collection

Role definitions with dynamic permission sets.

### Fields

| Field | Type | Flags | Notes |
|-------|------|-------|-------|
| `_id` | ObjectId | auto | Primary key |
| `name` | String | required, unique | e.g. "admin", "bd_intern", "tech_intern", "viewer" |
| `label` | String | required | Display name e.g. "BD Intern" |
| `permissions` | Object | required | Map of resource → actions array (see below) |
| `isSystemRole` | Boolean | default: false | True for hardcoded roles |
| `createdAt` | Date | timestamps | Mongoose auto |
| `updatedAt` | Date | timestamps | Mongoose auto |

### Permissions Shape

```javascript
permissions: {
  leads:       ["create","read","update","delete","assign"],
  clients:     ["read"],
  projects:    ["read"],
  followups:   ["create","read","update"],
  proposals:   ["create","read"],
  invoices:    [],          // empty = no access
  reports:     ["read"],
  team:        ["read"],
  settings:    []
}
```

### Default Roles

1. **Admin** — Full access to leads, CRUD on own data, team view
2. **BD Intern** — Create/read leads, update own followups/proposals
3. **Tech Intern** — Read-only on leads, create/read followups
4. **Viewer** — Read-only on leads, followups, proposals, reports

---

## UserSessions Collection

Refresh token store — enables multi-device logout and token revocation.

### Fields

| Field | Type | Flags | Notes |
|-------|------|-------|-------|
| `_id` | ObjectId | auto | Primary key |
| `userId` | ObjectId | required, FK→users, indexed | Owner of this session |
| `refreshTokenHash` | String | required | Hashed refresh token (never store plain) |
| `userAgent` | String | required | Browser/app info for "active sessions" UI |
| `deviceId` | String | required | Device fingerprint for multi-device fallback |
| `expiresAt` | Date | required, TTL index | MongoDB auto-deletes after this timestamp |
| `createdAt` | Date | timestamps | Mongoose auto |

### Indices

- `{ userId: 1, deviceId: 1 }` — Efficient device/session lookups
- `{ expiresAt: 1 }` — TTL index (auto-cleanup of expired sessions)

---

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install mongoose bcrypt
   npm install -D @types/bcrypt
   ```

2. Connect to MongoDB in your Express server:
   ```typescript
   import mongoose from 'mongoose'
   
   const mongoUri = process.env.MONGODB_URI
   await mongoose.connect(mongoUri, { dbName: 'crm_portal' })
   ```

3. Seed default roles (once):
   ```typescript
   import { seedRoles } from '@/server/models/seed'
   
   await seedRoles()
   ```

4. Use models in routes:
   ```typescript
   import { User, Role } from '@/server/models'
   
   const user = await User.findOne({ email }).populate('roleId')
   ```

---

## Security Notes

- ✓ `passwordHash` excluded from default queries (`select: false`)
- ✓ Bcrypt hashing enforced via pre-save middleware
- ✓ Unique indexes with `sparse: true` for optional fields
- ✓ Refresh tokens stored as hashes, never plain text
- ✓ Compound indices for efficient access control queries
- ✓ TTL index on UserSession for automatic cleanup
