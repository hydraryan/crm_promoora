import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth'
import { Activity } from '../models/Activity'
import { BUSINESS_TYPES, CLIENT_STATUSES, Client, type ClientBusinessType, type ClientStatus } from '../models/Client'
import { FollowUp } from '../models/FollowUp'
import { Project } from '../models/Project'
import { getAuthContext, isAdmin } from './_helpers'

const router = Router()

router.use(authenticateToken)

function serializeClient(client: any) {
  return {
    _id: client._id.toString(),
    businessName: client.businessName,
    ownerName: client.ownerName,
    phone: client.phone,
    email: client.email,
    businessType: client.businessType,
    status: client.status,
    assignedTo: {
      _id: (((client.assignedTo as { _id?: unknown } | undefined)?._id ?? client.assignedTo) as { toString: () => string }).toString(),
      name: (client.assignedTo as { name?: string })?.name ?? 'Unknown',
      initials: (client.assignedTo as { avatarInitials?: string })?.avatarInitials ?? 'NA',
    },
    website: client.website,
    address: client.address,
    services: client.services ?? [],
    onboardingStartedAt: client.onboardingStartedAt,
    activeFrom: client.activeFrom,
    contractValue: client.contractValue,
    notes: client.notes,
    createdAt: client.createdAt,
    convertedFromLead: client.convertedFromLead,
    createdBy: String(client.createdBy?._id ?? client.createdBy ?? ''),
  }
}

function assignedToId(client: any): string {
  const value = client?.assignedTo
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id?: unknown })._id ?? '')
  }
  return String(value ?? '')
}

function createdById(client: any): string {
  const value = client?.createdBy
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id?: unknown })._id ?? '')
  }
  return String(value ?? '')
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { status, businessType, assignedTo, search } = req.query
    const query: Record<string, unknown> = {}

    if (typeof status === 'string' && status && CLIENT_STATUSES.includes(status as ClientStatus)) {
      query.status = status
    }
    if (typeof businessType === 'string' && businessType && BUSINESS_TYPES.includes(businessType as ClientBusinessType)) {
      query.businessType = businessType
    }
    if (typeof assignedTo === 'string' && assignedTo) {
      query.assignedTo = assignedTo
    }
    if (typeof search === 'string' && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i')
      query.$or = [{ businessName: regex }, { ownerName: regex }]
    }

    let clients
    if (!isAdmin(auth.roleName)) {
      clients = await Client.find({
        ...query,
        $or: [{ assignedTo: auth.userId }, { createdBy: auth.userId }],
      })
        .populate('assignedTo', 'name avatarInitials')
        .sort({ createdAt: -1 })
    } else {
      clients = await Client.find(query).populate('assignedTo', 'name avatarInitials').sort({ createdAt: -1 })
    }

    return res.json({
      clients: clients.map((client) => serializeClient(client)),
      total: clients.length,
    })
  } catch (error) {
    console.error('Clients list error:', error)
    return res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can create clients' })
    }

    const {
      businessName,
      ownerName,
      phone,
      email,
      businessType,
      status,
      assignedTo,
      services,
      website,
      address,
      contractValue,
      onboardingStartedAt,
      notes,
      convertedFromLead,
    } = req.body as {
      businessName?: string
      ownerName?: string
      phone?: string
      email?: string
      businessType?: ClientBusinessType
      status?: ClientStatus
      assignedTo?: string
      services?: string[]
      website?: string
      address?: string
      contractValue?: number
      onboardingStartedAt?: string
      notes?: string
      convertedFromLead?: string
    }

    if (!businessName?.trim() || !ownerName?.trim() || !phone?.trim() || !businessType || !assignedTo) {
      return res.status(400).json({ error: 'businessName, ownerName, phone, businessType and assignedTo are required' })
    }

    if (!BUSINESS_TYPES.includes(businessType)) {
      return res.status(400).json({ error: 'Invalid businessType' })
    }

    const safeStatus: ClientStatus = status && CLIENT_STATUSES.includes(status) ? status : 'Onboarding'

    const client = await Client.create({
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: email?.trim() || undefined,
      businessType,
      status: safeStatus,
      assignedTo,
      services: Array.isArray(services) ? services : [],
      website: website?.trim() || undefined,
      address: address?.trim() || undefined,
      contractValue: typeof contractValue === 'number' && !Number.isNaN(contractValue) ? contractValue : undefined,
      onboardingStartedAt: onboardingStartedAt ? new Date(onboardingStartedAt) : safeStatus === 'Onboarding' ? new Date() : undefined,
      activeFrom: safeStatus === 'Active' ? new Date() : undefined,
      notes: notes?.trim() || undefined,
      convertedFromLead: convertedFromLead?.trim() || undefined,
      createdBy: auth.userId,
    })

    const populated = await client.populate('assignedTo', 'name avatarInitials')

    await Activity.create({
      actor: auth.userId,
      type: 'client_added',
      description: `added client ${client.businessName}`,
      targetName: client.businessName,
      targetId: client._id.toString(),
    })

    return res.status(201).json({ client: serializeClient(populated) })
  } catch (error) {
    console.error('Create client error:', error)
    return res.status(500).json({ error: 'Failed to create client' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const client = await Client.findById(req.params.id).populate('assignedTo', 'name avatarInitials')
    if (!client) return res.status(404).json({ error: 'Client not found' })

    if (!isAdmin(auth.roleName) && assignedToId(client) !== auth.userId && createdById(client) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to view this client' })
    }

    const projects = await Project.find({ client: client._id }).select('title status dueDate').sort({ createdAt: -1 })

    return res.json({
      client: {
        ...serializeClient(client),
        projects: projects.map((project) => ({
          _id: project._id.toString(),
          title: project.title,
          status: project.status,
          dueDate: project.dueDate,
        })),
      },
    })
  } catch (error) {
    console.error('Client detail error:', error)
    return res.status(500).json({ error: 'Failed to fetch client detail' })
  }
})

router.get('/:id/activity', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    if (!isAdmin(auth.roleName) && assignedToId(client) !== auth.userId && createdById(client) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to view this client activity' })
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
    console.error('Client activity error:', error)
    return res.status(500).json({ error: 'Failed to fetch client activity' })
  }
})

router.post('/:id/followups', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    if (!isAdmin(auth.roleName) && assignedToId(client) !== auth.userId && createdById(client) !== auth.userId) {
      return res.status(403).json({ error: 'Not allowed to add follow-up to this client' })
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
      clientId: client._id,
      targetType: 'client',
      businessName: client.businessName,
      ownerName: client.ownerName,
      type: modelType,
      note: note || undefined,
      assignedTo: assignedTo || client.assignedTo,
      dueAt: new Date(dueAt),
      createdBy: auth.userId,
    })

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `scheduled follow-up for ${client.businessName}${note ? `: ${note}` : ''}`,
      targetName: client.businessName,
      targetId: client._id.toString(),
    })

    return res.status(201).json({
      followup: {
        _id: followup._id.toString(),
        type: safeType,
        dueAt: followup.dueAt,
        note,
      },
    })
  } catch (error) {
    console.error('Add client follow-up error:', error)
    return res.status(500).json({ error: 'Failed to add follow-up' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can update clients' })
    }

    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const updates = req.body as Partial<{
      businessName: string
      ownerName: string
      phone: string
      email: string
      businessType: ClientBusinessType
      status: ClientStatus
      assignedTo: string
      services: string[]
      website: string
      address: string
      contractValue: number
      onboardingStartedAt: string
      activeFrom: string
      notes: string
    }>

    if (updates.businessType && !BUSINESS_TYPES.includes(updates.businessType)) {
      return res.status(400).json({ error: 'Invalid businessType' })
    }

    if (updates.status && !CLIENT_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    if (updates.status === 'Active' && client.status !== 'Active' && !updates.activeFrom) {
      updates.activeFrom = new Date().toISOString()
    }

    if (updates.status === 'Onboarding' && !client.onboardingStartedAt && !updates.onboardingStartedAt) {
      updates.onboardingStartedAt = new Date().toISOString()
    }

    if (updates.businessName !== undefined) client.businessName = updates.businessName.trim()
    if (updates.ownerName !== undefined) client.ownerName = updates.ownerName.trim()
    if (updates.phone !== undefined) client.phone = updates.phone.trim()
    if (updates.email !== undefined) client.email = updates.email.trim() || undefined
    if (updates.businessType !== undefined) client.businessType = updates.businessType
    if (updates.status !== undefined) client.status = updates.status
    if (updates.assignedTo !== undefined) client.assignedTo = updates.assignedTo as any
    if (updates.services !== undefined) client.services = Array.isArray(updates.services) ? updates.services : client.services
    if (updates.website !== undefined) client.website = updates.website.trim() || undefined
    if (updates.address !== undefined) client.address = updates.address.trim() || undefined
    if (updates.contractValue !== undefined) client.contractValue = updates.contractValue
    if (updates.onboardingStartedAt !== undefined) client.onboardingStartedAt = updates.onboardingStartedAt ? new Date(updates.onboardingStartedAt) : undefined
    if (updates.activeFrom !== undefined) client.activeFrom = updates.activeFrom ? new Date(updates.activeFrom) : undefined
    if (updates.notes !== undefined) client.notes = updates.notes.trim() || undefined

    await client.save()
    const populated = await client.populate('assignedTo', 'name avatarInitials')

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `updated client ${client.businessName}`,
      targetName: client.businessName,
      targetId: client._id.toString(),
    })

    return res.json({ client: serializeClient(populated) })
  } catch (error) {
    console.error('Update client error:', error)
    return res.status(500).json({ error: 'Failed to update client' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can delete clients' })
    }

    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    await Client.deleteOne({ _id: client._id })

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `deleted client ${client.businessName}`,
      targetName: client.businessName,
      targetId: client._id.toString(),
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Delete client error:', error)
    return res.status(500).json({ error: 'Failed to delete client' })
  }
})

export default router
