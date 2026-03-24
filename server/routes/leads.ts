import { Router, type Response } from 'express'
import multer from 'multer'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Lead, type BusinessType, type LeadStage } from '../models/Lead.js'
import { FollowUp } from '../models/FollowUp.js'
import { Activity } from '../models/Activity.js'
import { User } from '../models/User.js'
import { getAuthContext, isAdmin } from './_helpers.js'
import { createNotification } from '../services/notifications.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

const STAGES: LeadStage[] = ['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation', 'Won', 'Lost']
const BUSINESS_TYPES: BusinessType[] = ['restaurant', 'clinic', 'salon', 'shop', 'other']

type LeadSource = 'walk_in' | 'referral' | 'instagram' | 'cold_call' | 'other'
const SOURCES: LeadSource[] = ['walk_in', 'referral', 'instagram', 'cold_call', 'other']

router.use(authenticateToken)

function serializeLead(lead: any) {
  return {
    _id: lead._id.toString(),
    businessName: lead.businessName,
    ownerName: lead.ownerName,
    phone: lead.phone,
    email: lead.email,
    businessType: lead.businessType,
    stage: lead.stage,
    source: lead.source,
    notes: lead.notes,
    nextFollowupAt: lead.nextFollowupAt,
    createdBy: String(lead.createdBy?._id ?? lead.createdBy ?? ''),
    assignedTo: {
      _id: (((lead.assignedTo as { _id?: unknown } | undefined)?._id ?? lead.assignedTo) as { toString: () => string }).toString(),
      name: (lead.assignedTo as { name?: string })?.name ?? 'Unknown',
      initials: (lead.assignedTo as { avatarInitials?: string })?.avatarInitials ?? 'NA',
    },
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  }
}

function assignedToId(lead: any): string {
  const value = lead?.assignedTo
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id?: unknown })._id ?? '')
  }
  return String(value ?? '')
}

function createdById(lead: any): string {
  const value = lead?.createdBy
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id?: unknown })._id ?? '')
  }
  return String(value ?? '')
}

router.get('/pipeline-summary', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const query = auth.roleName === 'bd_intern' ? { assignedTo: auth.userId } : {}
    const leads = await Lead.find(query)
      .populate('assignedTo', 'name avatarInitials')
      .sort({ lastActivityAt: -1 })

    const stages = STAGES.map((stage) => {
      const stageLeads = leads.filter((lead) => lead.stage === stage)
      return {
        name: stage,
        count: stageLeads.length,
        leads: stageLeads.map((lead) => ({
          _id: lead._id,
          businessName: lead.businessName,
          ownerName: lead.ownerName,
          assignedTo: {
            name: (lead.assignedTo as { name?: string })?.name ?? 'Unknown',
            initials: (lead.assignedTo as { avatarInitials?: string })?.avatarInitials ?? 'NA',
          },
          lastActivityAt: lead.lastActivityAt,
          createdAt: lead.createdAt,
        })),
      }
    })

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const wonThisMonth = leads.filter((lead) => lead.stage === 'Won' && lead.updatedAt >= monthStart).length
    const lostThisMonth = leads.filter((lead) => lead.stage === 'Lost' && lead.updatedAt >= monthStart).length

    return res.json({
      totalLeads: leads.length,
      stages,
      wonThisMonth,
      lostThisMonth,
    })
  } catch (error) {
    console.error('Pipeline summary error:', error)
    return res.status(500).json({ error: 'Failed to fetch pipeline summary' })
  }
})

router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!(isAdmin(auth.roleName) || auth.roleName === 'bd_intern')) {
      return res.status(403).json({ error: 'Not allowed to import leads' })
    }

    const file = (req as AuthRequest & { file?: Express.Multer.File }).file

    if (!file) {
      return res.status(400).json({ error: 'CSV file is required' })
    }

    const csv = file.buffer.toString('utf-8')
    const lines = csv
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV has no data rows' })
    }

    const headers = lines[0].split(',').map((h: string) => h.trim())
    const required = ['businessName', 'ownerName', 'phone', 'businessType']

    const missing = required.filter((key) => !headers.includes(key))
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}` })
    }

    const errors: Array<{ row: number; reason: string }> = []
    let imported = 0

    for (let i = 1; i < lines.length; i += 1) {
      const row = lines[i].split(',').map((c: string) => c.trim())
      const record: Record<string, string> = {}
      headers.forEach((key: string, idx: number) => {
        record[key] = row[idx] ?? ''
      })

      if (!record.businessName || !record.ownerName || !record.phone) {
        errors.push({ row: i + 1, reason: 'businessName, ownerName and phone are required' })
        continue
      }

      if (!BUSINESS_TYPES.includes(record.businessType as BusinessType)) {
        errors.push({ row: i + 1, reason: 'Invalid businessType' })
        continue
      }

      const stage = STAGES.includes(record.stage as LeadStage) ? (record.stage as LeadStage) : 'Cold'
      const source = SOURCES.includes(record.source as LeadSource) ? (record.source as LeadSource) : undefined

      await Lead.create({
        businessName: record.businessName,
        ownerName: record.ownerName,
        phone: record.phone,
        email: record.email || undefined,
        businessType: record.businessType,
        stage,
        source,
        notes: record.notes || undefined,
        assignedTo: auth.userId,
        createdBy: auth.userId,
        lastActivityAt: new Date(),
      })

      imported += 1
    }

    return res.json({
      imported,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Import leads error:', error)
    return res.status(500).json({ error: 'Failed to import leads' })
  }
})

router.get('/:id/activity', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    if (!isAdmin(auth.roleName) && assignedToId(lead) !== auth.userId && createdById(lead) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to view this lead activity' })
    }

    const activities = await Activity.find({ targetId: req.params.id }).populate('actor', 'name avatarInitials').sort({ createdAt: -1 })

    return res.json({
      activities: activities.map((act) => ({
        _id: act._id.toString(),
        actor: {
          name: (act.actor as { name?: string })?.name ?? 'Unknown',
          initials: (act.actor as { avatarInitials?: string })?.avatarInitials ?? 'NA',
        },
        type: act.type,
        description: act.description,
        createdAt: act.createdAt,
      })),
    })
  } catch (error) {
    console.error('Lead activity error:', error)
    return res.status(500).json({ error: 'Failed to fetch lead activity' })
  }
})

router.post('/:id/followups', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    if (!isAdmin(auth.roleName) && createdById(lead) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to add follow-up to this lead' })
    }

    const { dueAt, note, type, assignedTo } = req.body as {
      dueAt?: string
      note?: string
      type?: 'Phone call' | 'Walk-in' | 'WhatsApp'
      assignedTo?: string
    }
    if (!dueAt) return res.status(400).json({ error: 'dueAt is required' })

    const safeType = type ?? 'Phone call'
    const modelType = safeType === 'Phone call' ? 'call' : safeType === 'Walk-in' ? 'walk-in' : 'whatsapp'

    const followup = await FollowUp.create({
      leadId: lead._id,
      targetType: 'lead',
      businessName: lead.businessName,
      ownerName: lead.ownerName,
      type: modelType,
      note: note || undefined,
      assignedTo: assignedTo || lead.assignedTo,
      dueAt: new Date(dueAt),
      createdBy: auth.userId,
    })

    lead.nextFollowupAt = new Date(dueAt)
    if (note) {
      lead.notes = lead.notes ? `${lead.notes}\n${note}` : note
    }
    lead.lastActivityAt = new Date()
    await lead.save()

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `scheduled follow-up for ${lead.businessName}${note ? `: ${note}` : ''}`,
      targetName: lead.businessName,
      targetId: lead._id.toString(),
    })

    const assignedId = String(assignedTo || lead.assignedTo)
    if (assignedId) {
      await createNotification({
        userId: assignedId,
        category: 'followup',
        title: 'New Follow-up Assigned',
        message: `${lead.businessName} follow-up is scheduled for ${new Date(dueAt).toLocaleString()}`,
        actionUrl: '/followups/today',
      })
    }

    return res.status(201).json({
      followup: {
        _id: followup._id.toString(),
        type: safeType,
        dueAt: followup.dueAt,
        note,
      },
    })
  } catch (error) {
    console.error('Add follow-up error:', error)
    return res.status(500).json({ error: 'Failed to add follow-up' })
  }
})

router.get('/mine', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const leads = await Lead.find({ assignedTo: auth.userId }).populate('assignedTo', 'name avatarInitials').sort({ createdAt: -1 })

    return res.json({
      leads: leads.map((lead) => serializeLead(lead)),
      total: leads.length,
    })
  } catch (error) {
    console.error('My leads error:', error)
    return res.status(500).json({ error: 'Failed to fetch my leads' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name avatarInitials')
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    if (!isAdmin(auth.roleName) && assignedToId(lead) !== auth.userId && createdById(lead) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to view this lead' })
    }

    const followups = await FollowUp.find({ leadId: lead._id }).sort({ dueAt: -1 })

    return res.json({
      lead: {
        ...serializeLead(lead),
        followups: followups.map((fu) => ({
          _id: fu._id.toString(),
          dueAt: fu.dueAt,
          isDone: fu.isDone,
          doneAt: fu.doneAt,
          type: fu.type,
        })),
      },
    })
  } catch (error) {
    console.error('Lead detail error:', error)
    return res.status(500).json({ error: 'Failed to fetch lead detail' })
  }
})

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { stage, assignedTo, businessType, createdToday, search } = req.query

    const query: Record<string, unknown> = {}

    if (typeof stage === 'string' && stage && stage !== 'all') query.stage = stage
    if (typeof assignedTo === 'string' && assignedTo) query.assignedTo = assignedTo
    if (typeof businessType === 'string' && businessType) query.businessType = businessType

    if (typeof search === 'string' && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i')
      query.$or = [{ businessName: regex }, { ownerName: regex }]
    }

    if (createdToday === 'true') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      query.createdAt = { $gte: start, $lt: end }
    }

    let leads
    if (!isAdmin(auth.roleName)) {
      // Non-admin users can see leads assigned to them or created by them.
      leads = await Lead.find({
        ...query,
        $or: [{ assignedTo: auth.userId }, { createdBy: auth.userId }],
      })
        .populate('assignedTo', 'name avatarInitials')
        .sort({ createdAt: -1 })
    } else {
      leads = await Lead.find(query).populate('assignedTo', 'name avatarInitials').sort({ createdAt: -1 })
    }

    return res.json({
      leads: leads.map((lead) => serializeLead(lead)),
      total: leads.length,
    })
  } catch (error) {
    console.error('Leads list error:', error)
    return res.status(500).json({ error: 'Failed to fetch leads' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    if (!(isAdmin(auth.roleName) || auth.roleName === 'bd_intern')) {
      return res.status(403).json({ error: 'Not allowed to create leads' })
    }

    const {
      businessName,
      ownerName,
      phone,
      email,
      businessType,
      stage,
      assignedTo,
      source,
      notes,
      nextFollowupAt,
    } = req.body as {
      businessName?: string
      ownerName?: string
      phone?: string
      email?: string
      businessType?: BusinessType
      stage?: LeadStage
      assignedTo?: string
      source?: LeadSource
      notes?: string
      nextFollowupAt?: string
    }

    if (!businessName?.trim() || !ownerName?.trim() || !phone?.trim() || !businessType || !assignedTo) {
      return res.status(400).json({ error: 'businessName, ownerName, phone, businessType and assignedTo are required' })
    }

    if (!BUSINESS_TYPES.includes(businessType)) return res.status(400).json({ error: 'Invalid businessType' })
    if (stage && !STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' })
    if (source && !SOURCES.includes(source)) return res.status(400).json({ error: 'Invalid source' })

    const assignedUser = isAdmin(auth.roleName) ? assignedTo : auth.userId

    const lead = await Lead.create({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email?.trim() || undefined,
      businessType,
      stage: stage ?? 'Cold',
      assignedTo: assignedUser,
      createdBy: auth.userId,
      source,
      notes,
      nextFollowupAt: nextFollowupAt ? new Date(nextFollowupAt) : undefined,
      lastActivityAt: new Date(),
    })

    await Activity.create({
      actor: auth.userId,
      type: 'lead_created',
      description: `created lead ${lead.businessName}`,
      targetName: lead.businessName,
      targetId: lead._id.toString(),
    })

    const assignedUserDoc = await User.findById(assignedUser).select('_id')
    if (assignedUserDoc) {
      await createNotification({
        userId: String(assignedUserDoc._id),
        category: 'lead',
        title: 'New Lead Assigned',
        message: `${lead.businessName} was assigned to you`,
        actionUrl: '/leads/all',
      })
    }

    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name avatarInitials')

    return res.status(201).json({ lead: serializeLead(populated) })
  } catch (error) {
    console.error('Create lead error:', error)
    return res.status(500).json({ error: 'Failed to create lead' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    const previousStage = lead.stage
    const previousAssignedUserId = assignedToId(lead)
    const changedFields: string[] = []

    if (!isAdmin(auth.roleName) && createdById(lead) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to update this lead' })
    }

    const allowed: Array<keyof typeof req.body> = [
      'businessName',
      'ownerName',
      'phone',
      'email',
      'businessType',
      'stage',
      'assignedTo',
      'source',
      'notes',
      'nextFollowupAt',
    ]

    for (const key of allowed) {
      const value = req.body[key]
      if (value === undefined) continue

      if (key === 'assignedTo' && !isAdmin(auth.roleName)) continue
      if (key === 'stage' && !STAGES.includes(value as LeadStage)) continue
      if (key === 'businessType' && !BUSINESS_TYPES.includes(value as BusinessType)) continue
      if (key === 'source' && value && !SOURCES.includes(value as LeadSource)) continue

      changedFields.push(String(key))

      if (key === 'nextFollowupAt') {
        ;(lead as any)[key] = value ? new Date(value as string) : undefined
      } else {
        ;(lead as any)[key] = value
      }
    }

    lead.lastActivityAt = new Date()
    await lead.save()

    const stageChanged = previousStage !== lead.stage

    await Activity.create({
      actor: auth.userId,
      type: stageChanged ? 'lead_stage_changed' : 'note',
      description: stageChanged
        ? `moved ${lead.businessName} from ${previousStage} to ${lead.stage}`
        : `updated lead ${lead.businessName}`,
      targetName: lead.businessName,
      targetId: lead._id.toString(),
      targetType: 'lead',
      meta: stageChanged
        ? {
            fromStage: previousStage,
            toStage: lead.stage,
          }
        : undefined,
    })

    const assignedUserId = assignedToId(lead)
    const wasReassigned = Boolean(previousAssignedUserId && assignedUserId && previousAssignedUserId !== assignedUserId)
    if (assignedUserId && assignedUserId !== auth.userId) {
      const summaryFields = changedFields
        .filter((field) => field !== 'notes')
        .slice(0, 3)
        .join(', ')

      await createNotification({
        userId: assignedUserId,
        category: 'lead',
        title: wasReassigned ? 'New Lead Assigned' : 'Lead Updated',
        message: wasReassigned
          ? `${lead.businessName} has now been assigned to you`
          : summaryFields
              ? `${lead.businessName} was updated (${summaryFields})`
              : `${lead.businessName} was updated`,
        actionUrl: '/leads/all',
      })
    }

    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name avatarInitials')
    return res.json({ lead: serializeLead(populated) })
  } catch (error) {
    console.error('Update lead error:', error)
    return res.status(500).json({ error: 'Failed to update lead' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Admin only action' })

    const lead = await Lead.findById(req.params.id)
    if (!lead) return res.status(404).json({ error: 'Lead not found' })

    await FollowUp.deleteMany({ leadId: lead._id })
    await Activity.deleteMany({ targetId: lead._id.toString() })
    await lead.deleteOne()

    return res.json({ success: true })
  } catch (error) {
    console.error('Delete lead error:', error)
    return res.status(500).json({ error: 'Failed to delete lead' })
  }
})

export default router
