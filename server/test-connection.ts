/**
 * Test MongoDB connection
 * Run with: npx tsx server/test-connection.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_USERNAME = process.env.MONGODB_USERNAME
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD

console.log('🔍 MongoDB Connection Test')
console.log('=' .repeat(50))

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local')
  process.exit(1)
}

const mongoUri: string = MONGODB_URI

console.log(`📋 Connection Details:`)
console.log(`   URI: ${mongoUri.replace(/:[^:]*@/, ':****@')}`)
console.log(`   Username: ${MONGODB_USERNAME}`)
console.log(`   Password: ${MONGODB_PASSWORD ? '••••••' : 'NOT SET'}`)
console.log('')

async function testConnection() {
  try {
    console.log('🔗 Attempting connection...')
    
    const startTime = Date.now()
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    })
    const connectTime = Date.now() - startTime

    console.log(`✅ Connected successfully! (${connectTime}ms)`)
    
    // Get database info
    const db = mongoose.connection.db
    if (!db) {
      throw new Error('Database handle unavailable after connection')
    }

    const admin = db.admin()
    const status = await admin.ping()
    console.log(`✅ Ping successful!`)
    
    // List databases
    const databases = await admin.listDatabases()
    console.log(`✅ Found ${databases.databases.length} database(s):`)
    databases.databases.slice(0, 5).forEach((db: any) => {
      console.log(`   - ${db.name}`)
    })

    console.log('')
    console.log('✨ Connection test passed! Ready to seed data.')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Connection failed!')
    console.error(`   Error: ${error.message}`)
    
    if (error.codeName === 'AtlasError') {
      console.error('')
      console.error('🔎 Troubleshooting tips:')
      console.error('   1. Check if IP is whitelisted in MongoDB Atlas')
      console.error('   2. Verify username and password are correct')
      console.error('   3. Check if user has permission to access the database')
      console.error('   4. Ensure special characters in password are URL-encoded')
    }

    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

testConnection()
