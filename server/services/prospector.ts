import { randomUUID } from 'node:crypto'
import type {
  ConfidenceBand,
  FootfallBand,
  IProspectorCandidate,
  IProspectorFilters,
  IProspectorProviderError,
  ProspectorProvider,
} from '../models/ProspectorJob.js'

type ProviderResult = {
  candidates: IProspectorCandidate[]
  errors: IProspectorProviderError[]
}

type GoogleSearchPlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  businessStatus?: string
  types?: string[]
}

type GooglePlaceDetails = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  primaryType?: string
  types?: string[]
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
  }
}

type GoogleSearchResponse = {
  places?: GoogleSearchPlace[]
  error?: {
    message?: string
  }
}

type GooglePlaceDetailsResponse = GooglePlaceDetails & {
  error?: {
    message?: string
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
}

function mapBusinessType(category?: string): 'restaurant' | 'clinic' | 'salon' | 'shop' | 'other' {
  const text = (category ?? '').toLowerCase()
  if (text.includes('cafe') || text.includes('restaurant')) return 'restaurant'
  if (text.includes('clinic') || text.includes('hospital') || text.includes('dental')) return 'clinic'
  if (text.includes('salon') || text.includes('spa') || text.includes('beauty')) return 'salon'
  if (text.includes('store') || text.includes('shop') || text.includes('retail') || text.includes('mart')) return 'shop'
  return 'other'
}

function toConfidence(reviewCount: number): ConfidenceBand {
  if (reviewCount >= 500) return 'high'
  if (reviewCount >= 200) return 'medium'
  return 'low'
}

function toFootfallEstimate(reviewCount: number, rating: number | undefined) {
  const safeRating = clampNumber(rating ?? 4, 0, 5)
  const dailyMid = Math.round(clampNumber(Math.sqrt(Math.max(0, reviewCount)) * 9 + (safeRating - 3) * 18, 20, 900))
  const dailyMin = Math.max(0, Math.round(dailyMid * 0.7))
  const dailyMax = Math.max(dailyMin + 1, Math.round(dailyMid * 1.3))
  const weeklyMin = dailyMin * 7
  const weeklyMax = dailyMax * 7

  let footfallBand: FootfallBand = 'low'
  if (dailyMid >= 220) {
    footfallBand = 'high'
  } else if (dailyMid >= 90) {
    footfallBand = 'medium'
  }

  return {
    footfallBand,
    footfallDailyMin: dailyMin,
    footfallDailyMax: dailyMax,
    footfallWeeklyMin: weeklyMin,
    footfallWeeklyMax: weeklyMax,
  }
}

function toActiveScore(params: { reviewCount: number; rating?: number; isOperational: boolean }): number {
  const reviewScore = clampNumber(params.reviewCount / 1000, 0, 1)
  const ratingScore = clampNumber((params.rating ?? 0) / 5, 0, 1)
  const operationalScore = params.isOperational ? 1 : 0.25
  return Math.round((reviewScore * 0.55 + ratingScore * 0.25 + operationalScore * 0.2) * 100)
}

function dedupeCandidates(rows: IProspectorCandidate[]): IProspectorCandidate[] {
  const seen = new Set<string>()
  const deduped: IProspectorCandidate[] = []

  for (const row of rows) {
    const key = row.placeId
      ? `place:${row.placeId}`
      : `${normalizeKey(row.name)}|${normalizeKey(row.phone ?? '')}|${normalizeKey(row.address ?? row.formattedAddress ?? '')}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }

  return deduped
}

async function fetchGooglePlaceDetails(apiKey: string, placeId: string): Promise<GooglePlaceDetails | null> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri,googleMapsUri,primaryType,types,regularOpeningHours.weekdayDescriptions',
    },
  })

  const payload = (await response.json()) as GooglePlaceDetailsResponse
  if (!response.ok) {
    return null
  }

  return payload
}

function toPlacePhone(details: GooglePlaceDetails): string | undefined {
  return details.internationalPhoneNumber?.trim() || details.nationalPhoneNumber?.trim() || undefined
}

async function enrichGoogleCandidate(item: GoogleSearchPlace, apiKey: string, minReviews: number): Promise<IProspectorCandidate | null> {
  const reviewCount = Math.max(0, item.userRatingCount ?? 0)
  const rating = typeof item.rating === 'number' ? item.rating : undefined
  const isOperational = (item.businessStatus ?? '').toUpperCase() === 'OPERATIONAL'
  const activeScore = toActiveScore({ reviewCount, rating, isOperational })
  const confidence = toConfidence(reviewCount)
  const footfall = toFootfallEstimate(reviewCount, rating)

  const placeId = item.id?.trim()
  let placeDetails: GooglePlaceDetails | null = null
  if (placeId) {
    placeDetails = await fetchGooglePlaceDetails(apiKey, placeId)
  }

  const website = placeDetails?.websiteUri?.trim() || undefined
  const placeUrl = placeDetails?.googleMapsUri?.trim() || undefined
  const openingHours = placeDetails?.regularOpeningHours?.weekdayDescriptions ?? []
  const primaryType = placeDetails?.primaryType?.trim() || item.types?.[0]
  const phone = placeDetails ? toPlacePhone(placeDetails) : undefined
  const address = placeDetails?.formattedAddress?.trim() || item.formattedAddress?.trim() || undefined

  const signals: string[] = []
  signals.push(`${reviewCount} reviews`)
  if (typeof rating === 'number') {
    signals.push(`rating ${rating.toFixed(1)}`)
  }
  signals.push(isOperational ? 'operational listing' : 'status unknown')
  if (phone) signals.push('phone available')
  if (website) signals.push('website available')
  if (openingHours.length > 0) signals.push('opening hours available')

  const candidate: IProspectorCandidate = {
    candidateId: randomUUID(),
    source: 'google-maps' as const,
    placeId,
    name: placeDetails?.displayName?.text?.trim() ?? item.displayName?.text?.trim() ?? '',
    address,
    formattedAddress: address,
    phone,
    website,
    placeUrl,
    category: primaryType,
    primaryType,
    rating,
    reviewCount,
    latestReviewAt: undefined,
    isActive: isOperational && reviewCount >= minReviews,
    activeScore,
    footfallBand: footfall.footfallBand,
    footfallDailyMin: footfall.footfallDailyMin,
    footfallDailyMax: footfall.footfallDailyMax,
    footfallWeeklyMin: footfall.footfallWeeklyMin,
    footfallWeeklyMax: footfall.footfallWeeklyMax,
    confidence,
    signals,
    openingHours,
  }

  return candidate.name.length > 0 ? candidate : null
}

async function fetchGoogleMapsCandidates(query: string, filters: IProspectorFilters): Promise<ProviderResult> {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return {
      candidates: [],
      errors: [
        {
          source: 'google-maps',
          message:
            'Google Maps API key not found. Set GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY / GOOGLE_API_KEY) in server environment.',
        },
      ],
    }
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.businessStatus,places.types',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: Math.min(Math.max(filters.maxResults * 2, 20), 100),
    }),
  })

  const payload = (await response.json()) as GoogleSearchResponse

  if (!response.ok) {
    return {
      candidates: [],
      errors: [
        {
          source: 'google-maps',
          message: payload.error?.message ?? `Google Places (New) request failed with ${response.status}`,
        },
      ],
    }
  }

  if (!Array.isArray(payload.places) || payload.places.length === 0) {
    return {
      candidates: [],
      errors: [],
    }
  }

  const candidates = (
    await Promise.all(payload.places.map((item) => enrichGoogleCandidate(item, apiKey, filters.minReviews)))
  )
    .filter((candidate): candidate is IProspectorCandidate => candidate !== null)
    .filter((candidate) => candidate.reviewCount >= filters.minReviews)
    .filter((candidate) => (filters.onlyNoWebsite ? !candidate.website : true))

  return { candidates, errors: [] }
}

function notConfiguredProvider(provider: ProspectorProvider): ProviderResult {
  return {
    candidates: [],
    errors: [{ source: provider, message: `${provider} adapter is not configured yet` }],
  }
}

export function mapCandidateBusinessType(candidate: Pick<IProspectorCandidate, 'category'>): 'restaurant' | 'clinic' | 'salon' | 'shop' | 'other' {
  return mapBusinessType(candidate.category)
}

export async function runProspectorQuery(params: {
  query: string
  filters: IProspectorFilters
  providers: ProspectorProvider[]
}): Promise<{ candidates: IProspectorCandidate[]; providerErrors: IProspectorProviderError[] }> {
  const allCandidates: IProspectorCandidate[] = []
  const providerErrors: IProspectorProviderError[] = []

  for (const provider of params.providers) {
    try {
      let result: ProviderResult

      if (provider === 'google-maps') {
        result = await fetchGoogleMapsCandidates(params.query, params.filters)
      } else if (provider === 'justdial') {
        result = notConfiguredProvider('justdial')
      } else {
        result = notConfiguredProvider('indiamart')
      }

      allCandidates.push(...result.candidates)
      providerErrors.push(...result.errors)
    } catch (error) {
      providerErrors.push({
        source: provider,
        message: error instanceof Error ? error.message : 'Unknown provider error',
      })
    }
  }

  const deduped = dedupeCandidates(allCandidates)
    .sort((a, b) => {
      if (b.activeScore !== a.activeScore) return b.activeScore - a.activeScore
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
      return (b.rating ?? 0) - (a.rating ?? 0)
    })
    .slice(0, params.filters.maxResults)

  return {
    candidates: deduped,
    providerErrors,
  }
}