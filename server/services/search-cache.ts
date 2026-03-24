import { Redis } from 'ioredis'

const CACHE_PREFIX = 'crm:search:v1:'
const CACHE_TTL_SECONDS = Number(process.env.SEARCH_CACHE_TTL_SECONDS ?? 30)

type MemoryEntry = {
  value: string
  expiresAt: number
}

const memoryCache = new Map<string, MemoryEntry>()

const redisUrl = process.env.SEARCH_REDIS_URL || process.env.REDIS_URL
const redisClient = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
  : null

let redisReady = false

async function ensureRedisConnection() {
  if (!redisClient || redisReady) return
  try {
    await redisClient.connect()
    redisReady = true
  } catch {
    redisReady = false
  }
}

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key)
    return null
  }
  return entry.value
}

function memorySet(key: string, value: string) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  })
}

export async function getCachedSearch<T>(cacheKey: string): Promise<T | null> {
  const key = `${CACHE_PREFIX}${cacheKey}`

  await ensureRedisConnection()

  if (redisClient && redisReady) {
    try {
      const value = await redisClient.get(key)
      if (value) return JSON.parse(value) as T
      return null
    } catch {
      // Fall back to in-memory cache if Redis is unavailable.
    }
  }

  const local = memoryGet(key)
  return local ? (JSON.parse(local) as T) : null
}

export async function setCachedSearch<T>(cacheKey: string, payload: T): Promise<void> {
  const key = `${CACHE_PREFIX}${cacheKey}`
  const value = JSON.stringify(payload)

  await ensureRedisConnection()

  if (redisClient && redisReady) {
    try {
      await redisClient.set(key, value, 'EX', CACHE_TTL_SECONDS)
      return
    } catch {
      // Fall back to in-memory cache if Redis is unavailable.
    }
  }

  memorySet(key, value)
}