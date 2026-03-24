import { Role, IRole } from './Role.js'
import { User, type IUser } from './User.js'
import bcrypt from 'bcrypt'

/**
 * Seed initial roles in the database
 * Call this after connecting to MongoDB
 */
export const seedRoles = async (): Promise<IRole[]> => {
  try {
    // Check if roles already exist
    const existingRoles = await Role.countDocuments()
    if (existingRoles > 0) {
      console.log('Roles already seeded. Skipping...')
      return await Role.find()
    }

    const defaultRoles = [
      {
        name: 'admin',
        label: 'Administrator',
        permissions: {
          dashboard: ['read'],
          leads: ['create', 'read', 'update', 'delete', 'assign'],
          clients: ['read'],
          projects: ['read'],
          followups: ['create', 'read', 'update'],
          proposals: ['create', 'read'],
          invoices: [],
          invoicing: [],
          communication: ['read'],
          reports: ['read'],
          team: ['read'],
          settings: [],
        },
        isSystemRole: true,
      },
      {
        name: 'bd_intern',
        label: 'BD Intern',
        permissions: {
          dashboard: ['read'],
          leads: ['create', 'read', 'update'],
          clients: ['read'],
          projects: ['read'],
          followups: ['create', 'read', 'update'],
          proposals: ['create', 'read'],
          invoices: [],
          invoicing: [],
          communication: ['read'],
          reports: ['read'],
          team: ['read'],
          settings: [],
        },
        isSystemRole: true,
      },
      {
        name: 'tech_intern',
        label: 'Tech Intern',
        permissions: {
          dashboard: ['read'],
          leads: ['read'],
          clients: ['read'],
          projects: ['read'],
          followups: ['create', 'read'],
          proposals: ['read'],
          invoices: [],
          invoicing: [],
          communication: [],
          reports: ['read'],
          team: ['read'],
          settings: [],
        },
        isSystemRole: true,
      },
      {
        name: 'viewer',
        label: 'Viewer',
        permissions: {
          dashboard: ['read'],
          leads: ['read'],
          clients: ['read'],
          projects: ['read'],
          followups: ['read'],
          proposals: ['read'],
          invoices: [],
          invoicing: [],
          communication: [],
          reports: ['read'],
          team: ['read'],
          settings: [],
        },
        isSystemRole: true,
      },
    ]

    const createdRoles = await Role.insertMany(defaultRoles)
    console.log(`✓ Seeded ${createdRoles.length} default roles`)
    return createdRoles
  } catch (error) {
    console.error('Error seeding roles:', error)
    throw error
  }
}

/**
 * Helper to hash a password with bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

/**
 * Helper to compare password with hash
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

/**
 * Seed the first admin user
 * Call this after seedRoles
 */
export const seedAdminUser = async (
  name: string,
  email: string,
  password: string
): Promise<IUser | null> => {
  try {
    // Check if admin user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      console.log(`✓ Admin user with email ${email} already exists. Skipping...`)
      return existingUser
    }

    // Get the admin role
    const adminRole = await Role.findOne({ name: 'admin' })
    if (!adminRole) {
      throw new Error('Admin role not found. Run seedRoles first.')
    }

    // Hash the password
    const passwordHash = await hashPassword(password)

    // Create the admin user
    const adminUser = await User.create({
      name,
      email,
      passwordHash,
      roleId: adminRole._id,
      status: 'active',
      isEmailVerified: true,
    })

    console.log(`✓ Seeded admin user: ${adminUser.email}`)
    return adminUser
  } catch (error) {
    console.error('Error seeding admin user:', error)
    throw error
  }
}
