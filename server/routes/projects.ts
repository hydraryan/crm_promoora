import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Activity } from '../models/Activity.js'
import { Client } from '../models/Client.js'
import { PROJECT_STATUSES, Project, SERVICE_TYPES, type ProjectStatus, type ServiceType } from '../models/Project.js'
import { getAuthContext, isAdmin } from './_helpers.js'

const router = Router()

router.use(authenticateToken)

function serializeTask(task: any) {
  return {
    _id: task._id.toString(),
    title: task.title,
    isDone: task.isDone,
    assignedTo: task.assignedTo
      ? {
          _id: String(task.assignedTo?._id ?? task.assignedTo),
          name: task.assignedTo?.name ?? 'Unknown',
          initials: task.assignedTo?.avatarInitials ?? 'NA',
        }
      : undefined,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
  }
}

function serializeProject(project: any) {
  return {
    _id: project._id.toString(),
    title: project.title,
    description: project.description,
    client: {
      _id: String(project.client?._id ?? project.client),
      businessName: project.client?.businessName ?? 'Unknown',
      ownerName: project.client?.ownerName ?? 'Unknown',
    },
    serviceType: project.serviceType,
    status: project.status,
    assignedTo: (project.assignedTo ?? []).map((member: any) => ({
      _id: String(member?._id ?? member),
      name: member?.name ?? 'Unknown',
      initials: member?.avatarInitials ?? 'NA',
    })),
    startDate: project.startDate,
    dueDate: project.dueDate,
    completedAt: project.completedAt,
    priority: project.priority,
    progress: project.progress,
    tasks: (project.tasks ?? []).map((task: any) => serializeTask(task)),
    notes: project.notes,
    createdAt: project.createdAt,
    createdBy: {
      _id: String(project.createdBy?._id ?? project.createdBy),
      name: project.createdBy?.name ?? 'Unknown',
      initials: project.createdBy?.avatarInitials ?? 'NA',
    },
  }
}

function isProjectEditor(roleName: string): boolean {
  return roleName === 'admin' || roleName === 'tech_intern'
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { status, serviceType, assignedTo, clientId, search } = req.query

    const andFilters: Array<Record<string, unknown>> = []

    if (typeof status === 'string' && status && PROJECT_STATUSES.includes(status as ProjectStatus)) {
      andFilters.push({ status })
    }
    if (typeof serviceType === 'string' && serviceType && SERVICE_TYPES.includes(serviceType as ServiceType)) {
      andFilters.push({ serviceType })
    }
    if (typeof assignedTo === 'string' && assignedTo) {
      andFilters.push({ assignedTo })
    }
    if (typeof clientId === 'string' && clientId) {
      andFilters.push({ client: clientId })
    }
    if (typeof search === 'string' && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i')
      const matchingClients = await Client.find({ businessName: regex }).select('_id')
      andFilters.push({ $or: [{ title: regex }, { client: { $in: matchingClients.map((client) => client._id) } }] })
    }

    if (!isAdmin(auth.roleName)) {
      andFilters.push({ $or: [{ assignedTo: auth.userId }, { createdBy: auth.userId }] })
    }

    const query = andFilters.length > 0 ? { $and: andFilters } : {}

    const projects = await Project.find(query)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .sort({ createdAt: -1 })

    return res.json({
      projects: projects.map((project) => serializeProject(project)),
      total: projects.length,
    })
  } catch (error) {
    console.error('Projects list error:', error)
    return res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isProjectEditor(auth.roleName)) {
      return res.status(403).json({ error: 'Not allowed to create projects' })
    }

    const { title, description, clientId, serviceType, status, assignedTo, priority, startDate, dueDate, notes } = req.body as {
      title?: string
      description?: string
      clientId?: string
      serviceType?: ServiceType
      status?: ProjectStatus
      assignedTo?: string[]
      priority?: 'low' | 'medium' | 'high'
      startDate?: string
      dueDate?: string
      notes?: string
    }

    if (!title?.trim() || !clientId || !serviceType || !Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ error: 'title, clientId, serviceType and assignedTo are required' })
    }

    if (!SERVICE_TYPES.includes(serviceType)) {
      return res.status(400).json({ error: 'Invalid serviceType' })
    }

    if (status && !PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const client = await Client.findById(clientId)
    if (!client) return res.status(404).json({ error: 'Client not found' })

    const safeStatus = status ?? 'In progress'
    const safePriority = priority ?? 'medium'

    const project = await Project.create({
      title: title.trim(),
      description: description?.trim() || undefined,
      client: clientId,
      serviceType,
      status: safeStatus,
      assignedTo,
      priority: safePriority,
      progress: safeStatus === 'Completed' ? 100 : 0,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      completedAt: safeStatus === 'Completed' ? new Date() : undefined,
      notes: notes?.trim() || undefined,
      createdBy: auth.userId,
    })

    const populated = await Project.findById(project._id)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `created project ${project.title}`,
      targetName: project.title,
      targetId: project._id.toString(),
    })

    return res.status(201).json({ project: serializeProject(populated) })
  } catch (error) {
    console.error('Create project error:', error)
    return res.status(500).json({ error: 'Failed to create project' })
  }
})

router.get('/:id/activity', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const canView = isAdmin(auth.roleName) || project.assignedTo.some((member) => member.toString() === auth.userId) || project.createdBy.toString() === auth.userId
    if (!canView) {
      return res.status(403).json({ error: 'Not allowed to view this project activity' })
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
    console.error('Project activity error:', error)
    return res.status(500).json({ error: 'Failed to fetch project activity' })
  }
})

router.post('/:id/tasks', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const canEdit = isProjectEditor(auth.roleName) || project.assignedTo.some((member) => member.toString() === auth.userId)
    if (!canEdit) {
      return res.status(403).json({ error: 'Not allowed to add tasks' })
    }

    const { title, assignedTo, dueDate } = req.body as { title?: string; assignedTo?: string; dueDate?: string }

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Task title is required' })
    }

    project.tasks.push({
      title: title.trim(),
      isDone: false,
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdAt: new Date(),
    } as any)

    await project.save()

    const populated = await Project.findById(project._id)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .populate('tasks.assignedTo', 'name avatarInitials')

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `added task to ${project.title}`,
      targetName: project.title,
      targetId: project._id.toString(),
    })

    return res.status(201).json({ project: serializeProject(populated) })
  } catch (error) {
    console.error('Add project task error:', error)
    return res.status(500).json({ error: 'Failed to add task' })
  }
})

router.patch('/:id/tasks/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const canEdit = isProjectEditor(auth.roleName) || project.assignedTo.some((member) => member.toString() === auth.userId)
    if (!canEdit) {
      return res.status(403).json({ error: 'Not allowed to update tasks' })
    }

    const task = project.tasks.find((item) => String(item._id) === String(req.params.taskId))
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const updates = req.body as Partial<{ isDone: boolean; title: string; assignedTo: string; dueDate: string }>

    if (updates.isDone !== undefined) task.isDone = updates.isDone
    if (updates.title !== undefined) task.title = updates.title.trim()
    if (updates.assignedTo !== undefined) (task as any).assignedTo = updates.assignedTo || undefined
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate ? new Date(updates.dueDate) : undefined

    const totalTasks = project.tasks.length
    const doneTasks = project.tasks.filter((item) => item.isDone).length
    project.progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : project.progress
    if (project.progress === 100 && project.status !== 'Completed') {
      project.status = 'Completed'
      project.completedAt = new Date()
    }

    await project.save()

    const populated = await Project.findById(project._id)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .populate('tasks.assignedTo', 'name avatarInitials')

    return res.json({ project: serializeProject(populated) })
  } catch (error) {
    console.error('Update project task error:', error)
    return res.status(500).json({ error: 'Failed to update task' })
  }
})

router.delete('/:id/tasks/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can delete tasks' })
    }

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const taskIndex = project.tasks.findIndex((item) => String(item._id) === String(req.params.taskId))
    const task = taskIndex >= 0 ? project.tasks[taskIndex] : null
    if (!task) return res.status(404).json({ error: 'Task not found' })

    project.tasks.splice(taskIndex, 1)
    await project.save()

    const populated = await Project.findById(project._id)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .populate('tasks.assignedTo', 'name avatarInitials')

    return res.json({ project: serializeProject(populated) })
  } catch (error) {
    console.error('Delete project task error:', error)
    return res.status(500).json({ error: 'Failed to delete task' })
  }
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const project = await Project.findById(req.params.id)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .populate('tasks.assignedTo', 'name avatarInitials')

    if (!project) return res.status(404).json({ error: 'Project not found' })

    const canView = isAdmin(auth.roleName) || project.assignedTo.some((member) => member._id.toString() === auth.userId) || project.createdBy._id.toString() === auth.userId
    if (!canView) {
      return res.status(403).json({ error: 'Not allowed to view this project' })
    }

    return res.json({ project: serializeProject(project) })
  } catch (error) {
    console.error('Project detail error:', error)
    return res.status(500).json({ error: 'Failed to fetch project detail' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const canEdit = isProjectEditor(auth.roleName) || project.assignedTo.some((member) => member.toString() === auth.userId)
    if (!canEdit) {
      return res.status(403).json({ error: 'Not allowed to update this project' })
    }

    const updates = req.body as Partial<{
      title: string
      description: string
      serviceType: ServiceType
      status: ProjectStatus
      assignedTo: string[]
      startDate: string
      dueDate: string
      completedAt: string
      priority: 'low' | 'medium' | 'high'
      progress: number
      notes: string
    }>

    if (updates.serviceType && !SERVICE_TYPES.includes(updates.serviceType)) {
      return res.status(400).json({ error: 'Invalid serviceType' })
    }

    if (updates.status && !PROJECT_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    if (updates.title !== undefined) project.title = updates.title.trim()
    if (updates.description !== undefined) project.description = updates.description.trim() || undefined
    if (updates.serviceType !== undefined) project.serviceType = updates.serviceType
    if (updates.status !== undefined) project.status = updates.status
    if (updates.assignedTo !== undefined && Array.isArray(updates.assignedTo) && updates.assignedTo.length > 0) project.assignedTo = updates.assignedTo as any
    if (updates.startDate !== undefined) project.startDate = updates.startDate ? new Date(updates.startDate) : undefined
    if (updates.dueDate !== undefined) project.dueDate = updates.dueDate ? new Date(updates.dueDate) : undefined
    if (updates.completedAt !== undefined) project.completedAt = updates.completedAt ? new Date(updates.completedAt) : undefined
    if (updates.priority !== undefined) project.priority = updates.priority
    if (updates.progress !== undefined) project.progress = Math.max(0, Math.min(100, updates.progress))
    if (updates.notes !== undefined) project.notes = updates.notes.trim() || undefined

    if (project.status === 'Completed' && !project.completedAt) {
      project.completedAt = new Date()
      project.progress = 100
    }

    await project.save()

    const populated = await Project.findById(project._id)
      .populate('client', 'businessName ownerName')
      .populate('assignedTo', 'name avatarInitials')
      .populate('createdBy', 'name avatarInitials')
      .populate('tasks.assignedTo', 'name avatarInitials')

    return res.json({ project: serializeProject(populated) })
  } catch (error) {
    console.error('Update project error:', error)
    return res.status(500).json({ error: 'Failed to update project' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can delete projects' })
    }

    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    await Project.deleteOne({ _id: project._id })

    await Activity.create({
      actor: auth.userId,
      type: 'note',
      description: `deleted project ${project.title}`,
      targetName: project.title,
      targetId: project._id.toString(),
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return res.status(500).json({ error: 'Failed to delete project' })
  }
})

export default router
