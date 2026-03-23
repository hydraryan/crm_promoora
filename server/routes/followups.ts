import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth'
import { FollowUp } from '../models/FollowUp'
import { Activity } from '../models/Activity'
import { getAuthContext, isAdmin } from './_helpers'

const router = Router()

router.use(authenticateToken)

function normalizeType(type: string): 'Phone call' | 'Walk-in' | 'WhatsApp' {
  if (type === 'Phone call' || type === 'call') return 'Phone call'
  if (type === 'Walk-in' || type === 'walk-in') return 'Walk-in'
  return 'WhatsApp'
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfTomorrow() {
  const d = startOfToday()
  d.setDate(d.getDate() + 1)
  return d
}

function serializeFollowup(fu: any) {
  const now = Date.now()
  const lead = fu.leadId as any
  const client = fu.clientId as any
  const targetType: 'lead' | 'client' = fu.targetType === 'client' ? 'client' : 'lead'

  return {
    _id: fu._id.toString(),
    lead:
      targetType === 'lead'
        ? {
            _id: lead?._id?.toString() ?? '',
            businessName: lead?.businessName ?? fu.businessName,
            ownerName: lead?.ownerName ?? fu.ownerName,
            phone: lead?.phone,
            email: lead?.email,
            stage: lead?.stage ?? 'Cold',
          }
        : undefined,
    client:
      targetType === 'client'
        ? {
            _id: client?._id?.toString() ?? '',
            businessName: client?.businessName ?? fu.businessName,
            ownerName: client?.ownerName ?? fu.ownerName,
            phone: client?.phone,
            email: client?.email,
          }
        : undefined,
    targetType,
    type: normalizeType(fu.type),
    note: fu.note,
    dueAt: fu.dueAt,
    isDone: fu.isDone,
    completedAt: fu.doneAt,
    isOverdue: !fu.isDone && new Date(fu.dueAt).getTime() < now,
    assignedTo: {
      _id: (((fu.assignedTo as { _id?: unknown } | undefined)?._id ?? fu.assignedTo) as { toString: () => string }).toString(),
      name: (fu.assignedTo as { name?: string })?.name ?? 'Unknown',
      initials: (fu.assignedTo as { avatarInitials?: string })?.avatarInitials ?? 'NA',
    },
    createdBy: {
      _id: (((fu.createdBy as { _id?: unknown } | undefined)?._id ?? fu.createdBy) as { toString: () => string }).toString(),
      name: (fu.createdBy as { name?: string })?.name ?? 'Unknown',
      initials: (fu.createdBy as { avatarInitials?: string })?.avatarInitials ?? 'NA',
    },
    createdAt: fu.createdAt,
  }
}

async function fetchFollowups(auth: { userId: string; roleName: string }, queryParams: Record<string, unknown>) {
  const todayStart = startOfToday()
  const tomorrowStart = startOfTomorrow()
  const { view, type, assignedTo, isDone, search } = queryParams as {
    view?: string
    type?: string
    assignedTo?: string
    isDone?: string
    search?: string
  }

  const andFilters: Array<Record<string, unknown>> = []

  if (typeof view === 'string') {
    if (view === 'overdue') {
      andFilters.push({ dueAt: { $lt: new Date() }, isDone: false })
    } else if (view === 'today') {
      andFilters.push({ dueAt: { $gte: todayStart, $lt: tomorrowStart } })
    } else if (view === 'upcoming') {
      andFilters.push({ dueAt: { $gte: tomorrowStart }, isDone: false })
    }
  }

  if (typeof type === 'string' && type) {
    const normalized = type === 'Phone call' ? ['Phone call', 'call'] : type === 'Walk-in' ? ['Walk-in', 'walk-in'] : ['WhatsApp', 'whatsapp']
    andFilters.push({ type: { $in: normalized } })
  }

  if (typeof assignedTo === 'string' && assignedTo) {
    andFilters.push({ assignedTo })
  }

  if (typeof isDone === 'string') {
    andFilters.push({ isDone: isDone === 'true' })
  }

  if (typeof search === 'string' && search.trim().length > 0) {
    const regex = new RegExp(search.trim(), 'i')
    andFilters.push({ businessName: regex })
  }

  if (!isAdmin(auth.roleName as any)) {
    andFilters.push({ assignedTo: auth.userId })
  }

  const query = andFilters.length > 0 ? { $and: andFilters } : {}

  const [followups, overdueCount] = await Promise.all([
    FollowUp.find(query)
      .populate('leadId', 'businessName ownerName phone email stage')
      .populate('clientId', 'businessName ownerName phone email')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .sort({ dueAt: 1 }),
    FollowUp.countDocuments({
      ...(isAdmin(auth.roleName as any) ? {} : { assignedTo: auth.userId }),
      isDone: false,
      dueAt: { $lt: new Date() },
    }),
  ])

  return {
    followups: followups.map((fu) => serializeFollowup(fu)),
    total: followups.length,
    overdueCount,
  }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const result = await fetchFollowups(auth, req.query as Record<string, unknown>)
    return res.json(result)
  } catch (error) {
    console.error('Follow-ups list error:', error)
    return res.status(500).json({ error: 'Failed to fetch follow-ups' })
  }
})

router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    const result = await fetchFollowups(auth, { ...req.query, view: 'today' })
    return res.json(result)
  } catch (error) {
    console.error('Follow-ups today error:', error)
    return res.status(500).json({ error: 'Failed to fetch follow-ups' })
  }
})

router.get('/overdue', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    const result = await fetchFollowups(auth, { ...req.query, view: 'overdue' })
    return res.json(result)
  } catch (error) {
    console.error('Follow-ups overdue error:', error)
    return res.status(500).json({ error: 'Failed to fetch follow-ups' })
  }
})

router.patch('/:id/done', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const followup = await FollowUp.findById(req.params.id)
    if (!followup) return res.status(404).json({ error: 'Follow-up not found' })

    if (!isAdmin(auth.roleName) && followup.assignedTo.toString() !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to update this follow-up' })
    }

    const payload = req.body as { isDone?: boolean }
    const nextState = payload.isDone ?? true

    followup.isDone = nextState
    followup.doneAt = nextState ? new Date() : undefined
    await followup.save()

    await Activity.create({
      actor: auth.userId,
      type: 'followup_done',
      description: `${nextState ? 'completed' : 'reopened'} follow-up - ${followup.businessName}`,
      targetName: followup.businessName,
      targetId: followup.targetType === 'client' ? followup.clientId?.toString() ?? followup._id.toString() : followup.leadId?.toString() ?? followup._id.toString(),
      targetType: followup.targetType,
      meta: {
        followupType: normalizeType(followup.type),
      },
    })

    return res.json({ success: true, isDone: followup.isDone, completedAt: followup.doneAt })
  } catch (error) {
    console.error('Follow-up done error:', error)
    return res.status(500).json({ error: 'Failed to mark follow-up as done' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can delete follow-ups' })
    }

    const followup = await FollowUp.findById(req.params.id)
    if (!followup) return res.status(404).json({ error: 'Follow-up not found' })

    await FollowUp.deleteOne({ _id: followup._id })
    return res.json({ success: true })
  } catch (error) {
    console.error('Delete follow-up error:', error)
    return res.status(500).json({ error: 'Failed to delete follow-up' })
  }
})

export default router
