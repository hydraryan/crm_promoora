import { Router, type Response } from 'express'
import { Types } from 'mongoose'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Lead } from '../models/Lead.js'
import { Client } from '../models/Client.js'
import { Proposal, PROPOSAL_STATUSES, type ProposalStatus } from '../models/Proposal.js'
import { Activity } from '../models/Activity.js'
import { getAuthContext, isAdmin } from './_helpers.js'

const router = Router()
router.use(authenticateToken)

function canEdit(role: string): boolean {
  return role === 'admin' || role === 'bd_intern'
}

function serializeProposal(proposal: any) {
  return {
    _id: proposal._id.toString(),
    proposalNumber: proposal.proposalNumber,
    title: proposal.title,
    status: proposal.status,
    lead:
      proposal.targetType === 'lead' && proposal.leadId
        ? {
            _id: String(proposal.leadId._id ?? proposal.leadId),
            businessName: proposal.leadId.businessName ?? '',
            ownerName: proposal.leadId.ownerName ?? '',
            phone: proposal.leadId.phone ?? '',
            email: proposal.leadId.email,
          }
        : undefined,
    client:
      proposal.targetType === 'client' && proposal.clientId
        ? {
            _id: String(proposal.clientId._id ?? proposal.clientId),
            businessName: proposal.clientId.businessName ?? '',
            ownerName: proposal.clientId.ownerName ?? '',
            phone: proposal.clientId.phone ?? '',
            email: proposal.clientId.email,
          }
        : undefined,
    targetType: proposal.targetType,
    serviceBlocks: proposal.serviceBlocks,
    milestones: proposal.milestones,
    notes: proposal.notes,
    createdBy: {
      _id: String(proposal.createdBy?._id ?? proposal.createdBy),
      name: proposal.createdBy?.name ?? 'Unknown',
      initials: proposal.createdBy?.avatarInitials ?? 'NA',
    },
    sentAt: proposal.sentAt,
    acceptedAt: proposal.acceptedAt,
    rejectedAt: proposal.rejectedAt,
    rejectionReason: proposal.rejectionReason,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  }
}

async function nextProposalNumber() {
  const year = new Date().getFullYear()
  const prefix = `PRO-${year}-`
  const latest = await Proposal.findOne({ proposalNumber: { $regex: `^${prefix}` } }).sort({ createdAt: -1 }).select('proposalNumber')

  if (!latest) return `${prefix}001`

  const tail = latest.proposalNumber.slice(prefix.length)
  const num = Number.parseInt(tail, 10)
  const next = Number.isNaN(num) ? 1 : num + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { status, search, createdBy } = req.query as { status?: string; search?: string; createdBy?: string }

    const andFilters: Array<Record<string, unknown>> = []

    if (status && PROPOSAL_STATUSES.includes(status as ProposalStatus)) {
      andFilters.push({ status })
    }

    if (createdBy) {
      andFilters.push({ createdBy })
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i')
      const leadIds = await Lead.find({ businessName: regex }).select('_id')
      const clientIds = await Client.find({ businessName: regex }).select('_id')
      andFilters.push({
        $or: [{ title: regex }, { leadId: { $in: leadIds.map((l) => l._id) } }, { clientId: { $in: clientIds.map((c) => c._id) } }],
      })
    }

    if (!isAdmin(auth.roleName)) {
      andFilters.push({ createdBy: auth.userId })
    }

    const query = andFilters.length > 0 ? { $and: andFilters } : {}

    const proposals = await Proposal.find(query)
      .populate('leadId', 'businessName ownerName phone email')
      .populate('clientId', 'businessName ownerName phone email')
      .populate('createdBy', 'name avatarInitials')
      .sort({ createdAt: -1 })

    return res.json({ proposals: proposals.map((proposal) => serializeProposal(proposal)), total: proposals.length })
  } catch (error) {
    console.error('Proposals list error:', error)
    return res.status(500).json({ error: 'Failed to fetch proposals' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!canEdit(auth.roleName)) return res.status(403).json({ error: 'Not allowed to create proposals' })

    const { title, targetType, leadId, clientId, serviceBlocks, milestones, notes, status, sentAt } = req.body as {
      title?: string
      targetType?: 'lead' | 'client'
      leadId?: string
      clientId?: string
      serviceBlocks?: Array<{ id: string; serviceKey: string; title: string; description: string; deliverables: string[] }>
      milestones?: Array<{ id: string; title: string; duration: string; description?: string }>
      notes?: string
      status?: ProposalStatus
      sentAt?: string
    }

    if (!title?.trim() || !targetType || !Array.isArray(serviceBlocks) || serviceBlocks.length === 0) {
      return res.status(400).json({ error: 'title, targetType and serviceBlocks are required' })
    }

    if (targetType === 'lead' && !leadId) return res.status(400).json({ error: 'leadId is required for lead proposals' })
    if (targetType === 'client' && !clientId) return res.status(400).json({ error: 'clientId is required for client proposals' })

    const proposalNumber = await nextProposalNumber()

    const proposal = await Proposal.create({
      proposalNumber,
      title: title.trim(),
      targetType,
      leadId: targetType === 'lead' ? leadId : undefined,
      clientId: targetType === 'client' ? clientId : undefined,
      serviceBlocks,
      milestones: milestones ?? [],
      notes: notes?.trim() || undefined,
      status: status && PROPOSAL_STATUSES.includes(status) ? status : 'Draft',
      sentAt: sentAt ? new Date(sentAt) : undefined,
      createdBy: auth.userId,
    })

    const populated = await Proposal.findById(proposal._id)
      .populate('leadId', 'businessName ownerName phone email')
      .populate('clientId', 'businessName ownerName phone email')
      .populate('createdBy', 'name avatarInitials')

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `created proposal ${proposal.proposalNumber}`,
      targetName:
        proposal.targetType === 'lead'
          ? ((populated?.leadId as { businessName?: string } | undefined)?.businessName ?? proposal.title)
          : ((populated?.clientId as { businessName?: string } | undefined)?.businessName ?? proposal.title),
      targetId:
        proposal.targetType === 'lead'
          ? String((proposal.leadId as unknown as { toString: () => string })?.toString?.() ?? proposal._id)
          : String((proposal.clientId as unknown as { toString: () => string })?.toString?.() ?? proposal._id),
      targetType: proposal.targetType,
      meta: {
        proposalNumber: proposal.proposalNumber,
      },
    })

    return res.status(201).json({ proposal: serializeProposal(populated) })
  } catch (error) {
    console.error('Create proposal error:', error)
    return res.status(500).json({ error: 'Failed to create proposal' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const proposal = await Proposal.findById(req.params.id)
      .populate('leadId', 'businessName ownerName phone email')
      .populate('clientId', 'businessName ownerName phone email')
      .populate('createdBy', 'name avatarInitials')

    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    if (!isAdmin(auth.roleName) && String(proposal.createdBy?._id ?? proposal.createdBy) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to view this proposal' })
    }

    return res.json({ proposal: serializeProposal(proposal) })
  } catch (error) {
    console.error('Proposal detail error:', error)
    return res.status(500).json({ error: 'Failed to fetch proposal' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })

    const isOwner = proposal.createdBy.toString() === auth.userId
    if (!isAdmin(auth.roleName) && !isOwner) {
      return res.status(403).json({ error: 'Not allowed to update this proposal' })
    }

    const payload = req.body as {
      title?: string
      targetType?: 'lead' | 'client'
      leadId?: string
      clientId?: string
      serviceBlocks?: Array<{ id: string; serviceKey: string; title: string; description: string; deliverables: string[] }>
      milestones?: Array<{ id: string; title: string; duration: string; description?: string }>
      notes?: string
      status?: ProposalStatus
      sentAt?: string
      acceptedAt?: string
      rejectedAt?: string
      rejectionReason?: string
    }

    const previousStatus = proposal.status

    if (typeof payload.title === 'string') proposal.title = payload.title.trim()
    if (payload.targetType === 'lead' || payload.targetType === 'client') proposal.targetType = payload.targetType
    if (payload.leadId !== undefined) proposal.leadId = payload.leadId ? new Types.ObjectId(payload.leadId) : undefined
    if (payload.clientId !== undefined) proposal.clientId = payload.clientId ? new Types.ObjectId(payload.clientId) : undefined
    if (Array.isArray(payload.serviceBlocks)) proposal.serviceBlocks = payload.serviceBlocks
    if (Array.isArray(payload.milestones)) proposal.milestones = payload.milestones
    if (payload.notes !== undefined) proposal.notes = payload.notes?.trim() || undefined

    if (payload.status && PROPOSAL_STATUSES.includes(payload.status)) {
      proposal.status = payload.status
      if (payload.status === 'Sent' && !proposal.sentAt) proposal.sentAt = payload.sentAt ? new Date(payload.sentAt) : new Date()
      if (payload.status === 'Accepted' && !proposal.acceptedAt) proposal.acceptedAt = payload.acceptedAt ? new Date(payload.acceptedAt) : new Date()
      if (payload.status === 'Rejected' && !proposal.rejectedAt) proposal.rejectedAt = payload.rejectedAt ? new Date(payload.rejectedAt) : new Date()
    }

    if (payload.sentAt) proposal.sentAt = new Date(payload.sentAt)
    if (payload.acceptedAt) proposal.acceptedAt = new Date(payload.acceptedAt)
    if (payload.rejectedAt) proposal.rejectedAt = new Date(payload.rejectedAt)
    if (payload.rejectionReason !== undefined) proposal.rejectionReason = payload.rejectionReason?.trim() || undefined

    await proposal.save()

    if (previousStatus !== 'Sent' && proposal.status === 'Sent') {
      const targetName =
        proposal.targetType === 'lead'
          ? ((await Lead.findById(proposal.leadId).select('businessName'))?.businessName ?? proposal.title)
          : ((await Client.findById(proposal.clientId).select('businessName'))?.businessName ?? proposal.title)

      await Activity.create({
        actor: auth.userId,
        type: 'proposal_sent',
        description: `sent proposal ${proposal.proposalNumber} to ${targetName}`,
        targetName,
        targetId:
          proposal.targetType === 'lead'
            ? String((proposal.leadId as unknown as { toString: () => string })?.toString?.() ?? proposal._id)
            : String((proposal.clientId as unknown as { toString: () => string })?.toString?.() ?? proposal._id),
        targetType: proposal.targetType,
        meta: {
          proposalNumber: proposal.proposalNumber,
        },
      })
    }

    const populated = await Proposal.findById(proposal._id)
      .populate('leadId', 'businessName ownerName phone email')
      .populate('clientId', 'businessName ownerName phone email')
      .populate('createdBy', 'name avatarInitials')

    return res.json({ proposal: serializeProposal(populated) })
  } catch (error) {
    console.error('Update proposal error:', error)
    return res.status(500).json({ error: 'Failed to update proposal' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can delete proposals' })

    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' })
    if (proposal.status !== 'Draft') return res.status(400).json({ error: 'Only draft proposals can be deleted' })

    await Proposal.deleteOne({ _id: proposal._id })
    return res.json({ success: true })
  } catch (error) {
    console.error('Delete proposal error:', error)
    return res.status(500).json({ error: 'Failed to delete proposal' })
  }
})

export default router
