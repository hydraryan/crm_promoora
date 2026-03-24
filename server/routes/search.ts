import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Client } from '../models/Client.js'
import { FollowUp } from '../models/FollowUp.js'
import { InvoiceModel } from '../models/Invoice.js'
import { Lead } from '../models/Lead.js'
import { Project } from '../models/Project.js'
import { Proposal } from '../models/Proposal.js'
import { User } from '../models/User.js'
import { getAuthContext, hasModulePermission, isAdmin } from './_helpers.js'
import { getCachedSearch, setCachedSearch } from '../services/search-cache.js'

const router = Router()
router.use(authenticateToken)

type SearchEntity = 'lead' | 'client' | 'project' | 'proposal' | 'followup' | 'invoice' | 'team-member'

type SearchResult = {
  id: string
  type: SearchEntity
  title: string
  subtitle: string
  meta?: string
  actionUrl: string
  score: number
  updatedAt?: string
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function scoreField(value: string | undefined, queryLower: string): number {
  if (!value) return 0
  const text = value.toLowerCase().trim()
  if (!text) return 0
  if (text === queryLower) return 120
  if (text.startsWith(queryLower)) return 90
  if (text.includes(queryLower)) return 60
  return 0
}

function recencyBoost(updatedAt: Date | undefined): number {
  if (!updatedAt) return 0
  const ageHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)
  if (ageHours <= 24) return 12
  if (ageHours <= 72) return 8
  if (ageHours <= 24 * 7) return 5
  return 0
}

function rankAndTrim(results: SearchResult[], limit: number) {
  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bTime - aTime
    })
    .slice(0, limit)
}

function buildQueryTokens(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9@._+\- ]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 2)
        .map((token) => token.slice(0, 16)),
    ),
  )
}

router.get('/', async (req: AuthRequest, res: Response) => {
  const startedAt = Date.now()

  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const q = String(req.query.q ?? '').trim()
    const requestedLimit = Number(req.query.limit ?? 5)
    const perTypeLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 10) : 5

    if (q.length < 2) {
      return res.json({
        q,
        results: [] as SearchResult[],
        total: 0,
        tookMs: Date.now() - startedAt,
      })
    }

    const queryLower = q.toLowerCase()
    const escaped = escapeRegex(q)
    const prefixRegex = new RegExp(`^${escaped}`, 'i')
    const containsRegex = new RegExp(escaped, 'i')
    const isNumberLike = /^\d+$/.test(q.replace(/\s+/g, ''))
    const queryTokens = buildQueryTokens(q)

    const cacheKey = `${auth.userId}:${auth.roleName}:${queryLower}:${perTypeLimit}`
    const cached = await getCachedSearch<{ q: string; results: SearchResult[]; total: number; tookMs: number }>(cacheKey)
    if (cached) return res.json({ ...cached, tookMs: Date.now() - startedAt, cache: 'hit' })

    const tasks: Array<Promise<SearchResult[]>> = []

    if (hasModulePermission(auth, 'leads', 'view')) {
      tasks.push(
        (async () => {
          const visibility = isAdmin(auth.roleName) ? {} : { $or: [{ assignedTo: auth.userId }, { createdBy: auth.userId }] }
          const leadQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { businessName: prefixRegex },
              { ownerName: prefixRegex },
              { businessName: containsRegex },
              { ownerName: containsRegex },
              ...(isNumberLike ? [{ phone: containsRegex }] : []),
            ],
          }
          const rows = await Lead.find(leadQuery).select('businessName ownerName stage phone updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row) => ({
              id: row._id.toString(),
              type: 'lead' as const,
              title: row.businessName,
              subtitle: `${row.ownerName} · ${row.stage}`,
              meta: row.phone,
              actionUrl: '/leads/all',
              updatedAt: row.updatedAt?.toISOString(),
              score:
                Math.max(scoreField(row.businessName, queryLower), scoreField(row.ownerName, queryLower), scoreField(row.phone, queryLower)) +
                recencyBoost(row.updatedAt),
            })),
            perTypeLimit,
          )
        })(),
      )
    }

    if (hasModulePermission(auth, 'clients', 'view')) {
      tasks.push(
        (async () => {
          const visibility = isAdmin(auth.roleName) ? {} : { $or: [{ assignedTo: auth.userId }, { createdBy: auth.userId }] }
          const clientQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { businessName: prefixRegex },
              { ownerName: prefixRegex },
              { businessName: containsRegex },
              { ownerName: containsRegex },
              ...(isNumberLike ? [{ phone: containsRegex }] : []),
            ],
          }
          const rows = await Client.find(clientQuery).select('businessName ownerName status phone updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row) => ({
              id: row._id.toString(),
              type: 'client' as const,
              title: row.businessName,
              subtitle: `${row.ownerName} · ${row.status}`,
              meta: row.phone,
              actionUrl: '/clients/all',
              updatedAt: row.updatedAt?.toISOString(),
              score:
                Math.max(scoreField(row.businessName, queryLower), scoreField(row.ownerName, queryLower), scoreField(row.phone, queryLower)) +
                recencyBoost(row.updatedAt),
            })),
            perTypeLimit,
          )
        })(),
      )
    }

    if (hasModulePermission(auth, 'projects', 'view')) {
      tasks.push(
        (async () => {
          const matchingClientIds = await Client.find({ businessName: containsRegex }).select('_id').limit(30)
          const visibility = isAdmin(auth.roleName) ? {} : { $or: [{ assignedTo: auth.userId }, { createdBy: auth.userId }] }
          const projectQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { title: prefixRegex },
              { title: containsRegex },
              { client: { $in: matchingClientIds.map((c) => c._id) } },
            ],
          }
          const rows = await Project.find(projectQuery).populate('client', 'businessName').select('title status serviceType client updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row: any) => {
              const clientName = row.client?.businessName ?? ''
              return {
                id: row._id.toString(),
                type: 'project' as const,
                title: row.title,
                subtitle: `${clientName || 'No client'} · ${row.status}`,
                meta: row.serviceType,
                actionUrl: '/projects/all',
                updatedAt: row.updatedAt?.toISOString(),
                score: Math.max(scoreField(row.title, queryLower), scoreField(clientName, queryLower)) + recencyBoost(row.updatedAt),
              }
            }),
            perTypeLimit,
          )
        })(),
      )
    }

    if (hasModulePermission(auth, 'proposals', 'view')) {
      tasks.push(
        (async () => {
          const matchingLeadIds = await Lead.find({ businessName: containsRegex }).select('_id').limit(30)
          const matchingClientIds = await Client.find({ businessName: containsRegex }).select('_id').limit(30)
          const visibility = isAdmin(auth.roleName) ? {} : { createdBy: auth.userId }
          const proposalQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { title: prefixRegex },
              { title: containsRegex },
              { proposalNumber: containsRegex },
              { leadId: { $in: matchingLeadIds.map((l) => l._id) } },
              { clientId: { $in: matchingClientIds.map((c) => c._id) } },
            ],
          }
          const rows = await Proposal.find(proposalQuery).select('title proposalNumber status updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row) => ({
              id: row._id.toString(),
              type: 'proposal' as const,
              title: row.title,
              subtitle: `${row.proposalNumber} · ${row.status}`,
              actionUrl: '/proposals/all',
              updatedAt: row.updatedAt?.toISOString(),
              score: Math.max(scoreField(row.title, queryLower), scoreField(row.proposalNumber, queryLower)) + recencyBoost(row.updatedAt),
            })),
            perTypeLimit,
          )
        })(),
      )
    }

    if (hasModulePermission(auth, 'followups', 'view')) {
      tasks.push(
        (async () => {
          const visibility = isAdmin(auth.roleName) ? {} : { assignedTo: auth.userId }
          const followupQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { businessName: prefixRegex },
              { ownerName: prefixRegex },
              { businessName: containsRegex },
              { ownerName: containsRegex },
              { note: containsRegex },
            ],
          }
          const rows = await FollowUp.find(followupQuery).select('businessName ownerName dueAt isDone updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row) => ({
              id: row._id.toString(),
              type: 'followup' as const,
              title: row.businessName,
              subtitle: `${row.ownerName} · ${row.isDone ? 'Completed' : 'Pending'}`,
              meta: row.dueAt ? `Due ${new Date(row.dueAt).toLocaleDateString('en-IN')}` : undefined,
              actionUrl: '/followups/today',
              updatedAt: row.updatedAt?.toISOString(),
              score: Math.max(scoreField(row.businessName, queryLower), scoreField(row.ownerName, queryLower), scoreField(row.note, queryLower)) + recencyBoost(row.updatedAt),
            })),
            perTypeLimit,
          )
        })(),
      )
    }

    if (hasModulePermission(auth, 'invoicing', 'view')) {
      tasks.push(
        (async () => {
          const matchingClientIds = await Client.find({ businessName: containsRegex }).select('_id').limit(30)
          const visibility = isAdmin(auth.roleName) ? {} : { createdBy: auth.userId }
          const invoiceQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { invoiceNumber: containsRegex },
              { clientId: { $in: matchingClientIds.map((c) => c._id) } },
            ],
          }
          const rows = await InvoiceModel.find(invoiceQuery).populate('clientId', 'businessName').select('invoiceNumber status clientId totalAmount updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row: any) => {
              const clientName = row.clientId?.businessName ?? ''
              return {
                id: row._id.toString(),
                type: 'invoice' as const,
                title: row.invoiceNumber,
                subtitle: `${clientName || 'Unknown client'} · ${row.status}`,
                meta: row.totalAmount !== undefined ? `INR ${Number(row.totalAmount).toLocaleString('en-IN')}` : undefined,
                actionUrl: '/invoicing/all',
                updatedAt: row.updatedAt?.toISOString(),
                score: Math.max(scoreField(row.invoiceNumber, queryLower), scoreField(clientName, queryLower)) + recencyBoost(row.updatedAt),
              }
            }),
            perTypeLimit,
          )
        })(),
      )
    }

    if (hasModulePermission(auth, 'team', 'view')) {
      tasks.push(
        (async () => {
          const visibility = isAdmin(auth.roleName) ? {} : { _id: auth.userId }
          const memberQuery = {
            ...visibility,
            $or: [
              ...(queryTokens.length > 0 ? [{ searchPrefixes: { $in: queryTokens } }] : []),
              { name: prefixRegex },
              { name: containsRegex },
              { email: containsRegex },
              ...(isNumberLike ? [{ phone: containsRegex }] : []),
            ],
          }
          const rows = await User.find(memberQuery).populate('roleId', 'name').select('name email phone avatarInitials roleId status updatedAt').sort({ updatedAt: -1 }).limit(perTypeLimit * 3)
          return rankAndTrim(
            rows.map((row: any) => ({
              id: row._id.toString(),
              type: 'team-member' as const,
              title: row.name,
              subtitle: `${row.email} · ${row.roleId?.name ?? 'viewer'}`,
              meta: row.phone,
              actionUrl: `/team/member/${row._id.toString()}`,
              updatedAt: row.updatedAt?.toISOString(),
              score: Math.max(scoreField(row.name, queryLower), scoreField(row.email, queryLower), scoreField(row.phone, queryLower)) + recencyBoost(row.updatedAt),
            })),
            perTypeLimit,
          )
        })(),
      )
    }

    const bucketResults = await Promise.all(tasks)
    const merged = rankAndTrim(bucketResults.flat(), perTypeLimit * 7)

    const payload = {
      q,
      results: merged,
      total: merged.length,
      tookMs: Date.now() - startedAt,
    }

    await setCachedSearch(cacheKey, payload)

    return res.json({ ...payload, cache: 'miss' })
  } catch (error) {
    console.error('Universal search error:', error)
    return res.status(500).json({ error: 'Failed to execute search' })
  }
})

export default router