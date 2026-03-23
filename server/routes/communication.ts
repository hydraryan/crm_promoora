import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth'
import { Activity, type ActivityOutcome } from '../models/Activity'
import { getAuthContext } from './_helpers'

const router = Router()
router.use(authenticateToken)

const COMM_EVENT_TYPES = ['followup_done', 'proposal_sent', 'invoice_sent', 'lead_stage_changed', 'stage_changed'] as const

type CommChannel = 'all' | 'whatsapp' | 'call' | 'walkin' | 'email' | 'internal'

function toInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

function deriveChannel(event: { type: string; meta?: { followupType?: string }; description?: string }): CommChannel {
  if (event.type === 'followup_done') {
    const followupType = event.meta?.followupType ?? event.description ?? ''
    const normalized = followupType.toLowerCase()

    if (normalized.includes('whatsapp')) return 'whatsapp'
    if (normalized.includes('phone call') || normalized.includes('call')) return 'call'
    if (normalized.includes('walk-in') || normalized.includes('walk in') || normalized.includes('walkin')) return 'walkin'
    return 'call'
  }
  if (event.type === 'proposal_sent' || event.type === 'invoice_sent') return 'email'
  if (event.type === 'lead_stage_changed' || event.type === 'stage_changed') return 'internal'
  return 'internal'
}

router.get('/log', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const {
      channel,
      actorId,
      targetId,
      from,
      to,
      search,
      page = '1',
      pageSize = '30',
    } = req.query as {
      channel?: string
      actorId?: string
      targetId?: string
      from?: string
      to?: string
      search?: string
      page?: string
      pageSize?: string
    }

    const effectiveActorId = auth.roleName !== 'admin' ? auth.userId : actorId || undefined

    const query: Record<string, unknown> = {
      type: { $in: COMM_EVENT_TYPES },
    }

    if (effectiveActorId) query.actor = effectiveActorId
    if (targetId) query.targetId = targetId

    if (search?.trim()) {
      query.targetName = { $regex: search.trim(), $options: 'i' }
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.$gte = new Date(`${from}T00:00:00.000Z`)
      if (to) dateFilter.$lte = new Date(`${to}T23:59:59.999Z`)
      query.createdAt = dateFilter
    }

    if (channel && channel !== 'all') {
      if (channel === 'whatsapp') {
        query.type = 'followup_done'
        query['meta.followupType'] = { $in: ['WhatsApp', 'whatsapp'] }
      } else if (channel === 'call') {
        query.type = 'followup_done'
        query['meta.followupType'] = { $in: ['Phone call', 'call', 'Walk-in', 'walk-in'] }
      } else if (channel === 'walkin') {
        query.type = 'followup_done'
        query['meta.followupType'] = { $in: ['Walk-in', 'walk-in'] }
      } else if (channel === 'email') {
        query.type = { $in: ['proposal_sent', 'invoice_sent'] }
      } else if (channel === 'internal') {
        query.type = { $in: ['lead_stage_changed', 'stage_changed'] }
      }
    }

    const safePage = Math.max(Number.parseInt(page, 10) || 1, 1)
    const safePageSize = Math.min(Math.max(Number.parseInt(pageSize, 10) || 30, 1), 100)
    const skip = (safePage - 1) * safePageSize

    const [items, total] = await Promise.all([
      Activity.find(query).populate('actor', 'name avatarInitials').sort({ createdAt: -1 }).skip(skip).limit(safePageSize),
      Activity.countDocuments(query),
    ])

    const enriched = items.map((item) => {
      const actorRef = item.actor as { _id?: unknown; name?: string; avatarInitials?: string }
      const actorName = actorRef?.name ?? 'Unknown'
      return {
        _id: item._id.toString(),
        channel: deriveChannel(item),
        type: item.type,
        actor: {
          _id: (((actorRef?._id ?? item.actor) as { toString: () => string })?.toString?.() ?? '').toString(),
          name: actorName,
          initials: actorRef?.avatarInitials ?? toInitials(actorName || 'NA'),
        },
        target: {
          _id: item.targetId,
          name: item.targetName,
          targetType: item.targetType ?? (item.type === 'invoice_sent' ? 'client' : 'lead'),
        },
        description: item.description,
        outcome: item.outcome,
        meta: item.meta,
        createdAt: item.createdAt,
      }
    })

    return res.json({
      items: enriched,
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: skip + items.length < total,
    })
  } catch (error) {
    console.error('Communication log error:', error)
    return res.status(500).json({ error: 'Failed to fetch communication log' })
  }
})

router.patch('/log/:id/outcome', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { outcome } = req.body as { outcome?: ActivityOutcome }

    if (!outcome || !['positive', 'neutral', 'follow-up needed'].includes(outcome)) {
      return res.status(400).json({ error: 'Invalid outcome' })
    }

    const entry = await Activity.findById(req.params.id)
    if (!entry) return res.status(404).json({ error: 'Not found' })
    if (entry.type !== 'followup_done') return res.status(400).json({ error: 'Outcome can only be set on follow-up entries' })

    const actorId = (entry.actor as { toString: () => string }).toString()
    if (auth.roleName !== 'admin' && actorId !== auth.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    entry.outcome = outcome
    await entry.save()

    return res.json({ success: true })
  } catch (error) {
    console.error('Communication outcome update error:', error)
    return res.status(500).json({ error: 'Failed to update outcome' })
  }
})

export default router
