import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Role } from '../server/models/Role'

dotenv.config({ path: '.env.local' })

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is missing in .env.local')
  }

  await mongoose.connect(uri)

  const full = ['create', 'read', 'update', 'delete']

  const updated = await Role.findOneAndUpdate(
    { name: 'admin' },
    {
      $set: {
        permissions: {
          leads: [...full, 'assign'],
          clients: full,
          projects: full,
          followups: full,
          proposals: full,
          invoices: full,
          invoicing: full,
          communication: full,
          reports: full,
          team: full,
          settings: full,
        },
        disabledModules: [],
      },
    },
    { new: true },
  )

  if (!updated) {
    throw new Error('Admin role not found')
  }

  console.log('Recovered role:', updated.name)
  console.log('Disabled modules:', updated.disabledModules)
  console.log('Leads permissions:', updated.permissions?.leads)
  console.log('Settings permissions:', updated.permissions?.settings)

  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error('Recovery failed:', error)
  await mongoose.disconnect()
  process.exit(1)
})
