import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { getAuthContext, hasModulePermission, isAdmin } from './_helpers.js'
import { ProspectorJob, type ProspectorProvider } from '../models/ProspectorJob.js'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Activity } from '../models/Activity.js'
import { runProspectorQuery, mapCandidateBusinessType } from '../services/prospector.js'

const router = Router()

router.use(authenticateToken)

function normalizeProviders(raw: unknown): ProspectorProvider[] {
  const supported: ProspectorProvider[] = ['google-maps']
  if (!Array.isArray(raw) || raw.length === 0) return supported
  return raw.filter((item): item is ProspectorProvider => supported.includes(item as ProspectorProvider))
}

router.post('/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!hasModulePermission(auth, 'prospector', 'create')) {
      return res.status(403).json({ error: 'Not allowed to run prospector jobs' })
    }

    // Limit check
    if (!isAdmin(auth.roleName)) {
      const user = await User.findById(auth.userId).populate('roleId')
      if (!user) return res.status(401).json({ error: 'User not found' })

      const role = user.roleId as any
      const limit = user.prospectorBudgetOverride ?? role?.dailySearchLimit ?? 5

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const count = await ProspectorJob.countDocuments({
        createdBy: auth.userId,
        createdAt: { $gte: startOfDay },
      })

      if (count >= limit) {
        return res.status(403).json({
          error: `Daily search limit reached (${limit}). Please contact your admin.`,
        })
      }
    }

    const body = req.body as {
      query?: string
      minReviews?: number
      recencyDays?: number
      maxResults?: number
      onlyNoWebsite?: boolean
      providers?: ProspectorProvider[]
    }

    const query = body.query?.trim() ?? ''
    if (query.length < 3) {
      return res.status(400).json({ error: 'Query must be at least 3 characters long' })
    }

    const filters = {
      minReviews: Math.max(0, Math.floor(body.minReviews ?? 200)),
      recencyDays: Math.max(1, Math.floor(body.recencyDays ?? 30)),
      maxResults: Math.min(200, Math.max(1, Math.floor(body.maxResults ?? 25))),
      onlyNoWebsite: Boolean(body.onlyNoWebsite),
    }

    const providers = normalizeProviders(body.providers)

    const job = await ProspectorJob.create({
      query,
      status: 'pending',
      filters,
      providers,
      createdBy: auth.userId,
    })

    const result = await runProspectorQuery({ query, filters, providers })
    job.candidates = result.candidates
    job.providerErrors = result.providerErrors
    job.status = 'completed'
    job.completedAt = new Date()
    await job.save()

    return res.status(201).json({
      job: {
        _id: job._id.toString(),
        query: job.query,
        status: job.status,
        filters: job.filters,
        providers: job.providers,
        providerErrors: job.providerErrors,
        candidates: job.candidates,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
    })
  } catch (error) {
    console.error('Prospector create job error:', error)
    return res.status(500).json({ error: 'Failed to run prospector job' })
  }
})

router.get('/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!hasModulePermission(auth, 'prospector', 'view')) {
      return res.status(403).json({ error: 'Not allowed to view prospector jobs' })
    }

    const limit = Math.min(30, Math.max(1, Number(req.query.limit ?? 10)))
    const query = isAdmin(auth.roleName) ? {} : { createdBy: auth.userId }

    const jobs = await ProspectorJob.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id query status filters providers providerErrors candidates completedAt createdAt')

    return res.json({
      jobs: jobs.map((job) => ({
        _id: job._id.toString(),
        query: job.query,
        status: job.status,
        filters: job.filters,
        providers: job.providers,
        providerErrors: job.providerErrors,
        candidatesCount: job.candidates.length,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      })),
    })
  } catch (error) {
    console.error('Prospector list jobs error:', error)
    return res.status(500).json({ error: 'Failed to fetch prospector jobs' })
  }
})

router.get('/jobs/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!hasModulePermission(auth, 'prospector', 'view')) {
      return res.status(403).json({ error: 'Not allowed to view prospector jobs' })
    }

    const job = await ProspectorJob.findById(req.params.id)
    if (!job) return res.status(404).json({ error: 'Prospector job not found' })

    if (!isAdmin(auth.roleName) && String(job.createdBy) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to access this prospector job' })
    }

    return res.json({
      job: {
        _id: job._id.toString(),
        query: job.query,
        status: job.status,
        filters: job.filters,
        providers: job.providers,
        providerErrors: job.providerErrors,
        candidates: job.candidates,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
    })
  } catch (error) {
    console.error('Prospector get job error:', error)
    return res.status(500).json({ error: 'Failed to fetch prospector job' })
  }
})

router.post('/jobs/:id/import', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!hasModulePermission(auth, 'prospector', 'view') || !hasModulePermission(auth, 'leads', 'create')) {
      return res.status(403).json({ error: 'Not allowed to import prospector leads' })
    }

    const job = await ProspectorJob.findById(req.params.id)
    if (!job) return res.status(404).json({ error: 'Prospector job not found' })
    if (!isAdmin(auth.roleName) && String(job.createdBy) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to import from this job' })
    }

    const body = req.body as {
      candidateIds?: string[]
      assignedTo?: string
    }

    const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds : []
    if (candidateIds.length === 0) {
      return res.status(400).json({ error: 'At least one candidate must be selected' })
    }

    const selected = job.candidates.filter((candidate) => candidateIds.includes(candidate.candidateId))
    if (selected.length === 0) {
      return res.status(400).json({ error: 'No matching candidates found in this job' })
    }

    const assignedTo = body.assignedTo?.trim() || auth.userId

    let created = 0
    let skippedDuplicates = 0
    let skippedInvalid = 0

    for (const candidate of selected) {
      if (!candidate.name || !candidate.isActive || candidate.reviewCount < job.filters.minReviews) {
        skippedInvalid += 1
        continue
      }

      const duplicate = await Lead.findOne({
        $or: [
          ...(candidate.placeId ? [{ sourcePlaceId: candidate.placeId }] : []),
          {
            businessName: new RegExp(`^${candidate.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            ...(candidate.phone ? { phone: candidate.phone } : {}),
          },
        ],
      }).lean()

      if (duplicate) {
        skippedDuplicates += 1
        continue
      }

      const leadPhone = candidate.phone?.trim() || candidate.phone || 'NA'

      await Lead.create({
        businessName: candidate.name,
        ownerName: candidate.name,
        phone: leadPhone,
        sourceProvider: candidate.source,
        sourcePlaceId: candidate.placeId,
        sourcePlaceUrl: candidate.placeUrl,
        sourceWebsite: candidate.website,
        sourcePhone: candidate.phone,
        sourceAddress: candidate.formattedAddress ?? candidate.address,
        sourceCategory: candidate.primaryType ?? candidate.category,
        sourceOpeningHours: candidate.openingHours ?? [],
        email: undefined,
        businessType: mapCandidateBusinessType(candidate),
        stage: 'Cold',
        source: 'other',
        notes: [
          `Prospector Query: ${job.query}`,
          `Source: ${candidate.source}`,
          candidate.placeId ? `Place ID: ${candidate.placeId}` : undefined,
          candidate.placeUrl ? `Maps: ${candidate.placeUrl}` : undefined,
          candidate.website ? `Website: ${candidate.website}` : undefined,
          candidate.phone ? `Phone: ${candidate.phone}` : undefined,
          `Reviews: ${candidate.reviewCount}`,
          candidate.rating ? `Rating: ${candidate.rating}` : undefined,
          `Footfall: ${candidate.footfallBand} (${candidate.footfallDailyMin}-${candidate.footfallDailyMax}/day)`,
        ]
          .filter(Boolean)
          .join(' | '),
        assignedTo,
        createdBy: auth.userId,
        lastActivityAt: new Date(),
      })

      created += 1
    }

    await Activity.create({
      actor: auth.userId,
      type: 'lead_created',
      description: `imported ${created} leads from prospector job`,
      targetName: 'Prospector import',
      targetId: job._id.toString(),
      meta: {
        query: job.query,
        selected: selected.length,
        created,
        skippedDuplicates,
        skippedInvalid,
      },
    })

    return res.json({
      imported: created,
      skippedDuplicates,
      skippedInvalid,
      selected: selected.length,
    })
  } catch (error) {
    console.error('Prospector import error:', error)
    return res.status(500).json({ error: 'Failed to import prospector leads' })
  }
})

export default router