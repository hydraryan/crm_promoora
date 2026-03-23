import mongoose from 'mongoose'
import dns from 'node:dns'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_URI_FALLBACK = process.env.MONGODB_URI_FALLBACK

if (!MONGODB_URI && !MONGODB_URI_FALLBACK) {
  throw new Error('MONGODB_URI not found in environment variables')
}

const DNS_FALLBACK_SERVERS = ['8.8.8.8', '1.1.1.1']

function isSrvDnsError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  return code === 'ESERVFAIL' || code === 'ENOTFOUND' || code === 'ETIMEOUT'
}

async function connectWithUri(uri: string) {
  await mongoose.connect(uri)
}

export const connectDatabase = async () => {
  const primaryUri = MONGODB_URI ?? MONGODB_URI_FALLBACK
  if (!primaryUri) {
    throw new Error('No MongoDB URI configured')
  }

  try {
    console.log('📡 Connecting to MongoDB...')
    await connectWithUri(primaryUri)
    console.log('✅ MongoDB connected')
    return mongoose.connection
  } catch (error) {
    if (primaryUri.startsWith('mongodb+srv://') && isSrvDnsError(error)) {
      try {
        console.warn('⚠ MongoDB SRV DNS lookup failed. Retrying with public DNS servers...')
        dns.setServers(DNS_FALLBACK_SERVERS)
        await connectWithUri(primaryUri)
        console.log('✅ MongoDB connected (after DNS fallback)')
        return mongoose.connection
      } catch (dnsRetryError) {
        if (MONGODB_URI_FALLBACK && MONGODB_URI_FALLBACK !== primaryUri) {
          try {
            console.warn('⚠ Retrying with MONGODB_URI_FALLBACK...')
            await connectWithUri(MONGODB_URI_FALLBACK)
            console.log('✅ MongoDB connected (using fallback URI)')
            return mongoose.connection
          } catch (fallbackError) {
            console.error('❌ MongoDB fallback connection failed:', fallbackError)
            throw fallbackError
          }
        }

        console.error('❌ MongoDB DNS retry failed:', dnsRetryError)
        throw dnsRetryError
      }
    }

    if (MONGODB_URI_FALLBACK && MONGODB_URI_FALLBACK !== primaryUri) {
      try {
        console.warn('⚠ Primary MongoDB URI failed. Retrying with MONGODB_URI_FALLBACK...')
        await connectWithUri(MONGODB_URI_FALLBACK)
        console.log('✅ MongoDB connected (using fallback URI)')
        return mongoose.connection
      } catch (fallbackError) {
        console.error('❌ MongoDB fallback connection failed:', fallbackError)
        throw fallbackError
      }
    }

    console.error('❌ MongoDB connection failed:', error)
    throw error
  }
}

export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect()
    console.log('✅ MongoDB disconnected')
  } catch (error) {
    console.error('❌ MongoDB disconnection failed:', error)
    throw error
  }
}
