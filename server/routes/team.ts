import { Router, type Response } from 'express'
import { Types } from 'mongoose'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'
import { Lead } from '../models/Lead.js'
import { FollowUp } from '../models/FollowUp.js'
import { Project } from '../models/Project.js'
import { Proposal } from '../models/Proposal.js'
import { Activity } from '../models/Activity.js'
import { UserSession } from '../models/UserSession.js'
import { hashPassword } from '../models/seed.js'
import { getAuthContext, isAdmin } from './_helpers.js'

const router = Router()
router.use(authenticateToken)

type RoleName = string

type SessionLite = {
  _id: string
  userId: string
  loginAt: string
  logoutAt?: string
  ipAddress?: string
  userAgent?: string
}

function toRoleName(rawRole: unknown): RoleName {
  if (typeof rawRole === 'object' && rawRole && 'name' in rawRole) {
    const value = (rawRole as { name?: string }).name
    if (value && typeof value === 'string') return value
  }
  if (typeof rawRole === 'string' && rawRole.trim()) return rawRole
  return 'viewer'
}

function toInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

function serializeMember(user: any) {
  const role = toRoleName(user.roleId)
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email ?? '',
    phone: user.phone ?? '',
    role,
    initials: user.avatarInitials || toInitials(user.name || 'NA'),
    status: user.status === 'active' ? 'active' : 'inactive',
    joinedAt: user.createdAt,
    createdBy: String(user.createdBy?._id ?? user.createdBy ?? ''),
    invitePending: user.status !== 'active' && !user.isEmailVerified,
    createdAt: user.createdAt,
  }
}

function canViewMember(authRole: RoleName, authUserId: string, memberId: string) {
  if (authRole === 'admin') return true
  return authUserId === memberId
}

function getRouteId(paramValue: string | string[] | undefined): string {
  if (Array.isArray(paramValue)) return paramValue[0] ?? ''
  return paramValue ?? ''
}

function monthBounds(month: string) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)
  const start = new Date(`${safeMonth}-01T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return { month: safeMonth, start, end }
}

function formatDayKeyIST(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(value)
}

function buildMonthlyAttendance(month: string, sessions: SessionLite[]) {
  const { month: safeMonth, start, end } = monthBounds(month)
  const today = new Date()

  const byDay = new Map<string, SessionLite[]>()
  sessions.forEach((session) => {
    const login = new Date(session.loginAt)
    const key = formatDayKeyIST(login)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)?.push(session)
  })

  const days: Array<{
    date: string
    dayOfWeek: number
    isWorkingDay: boolean
    sessions: SessionLite[]
    firstLogin?: string
    lastLogout?: string
    totalMinutes: number
    status: 'present' | 'absent' | 'optional' | 'active'
  }> = []

  let cursor = new Date(start)
  let presentDays = 0
  let absentDays = 0
  let optionalDays = 0
  let totalWorkingDays = 0
  let totalMinutesInPresentDays = 0

  while (cursor < end) {
    const dateKey = cursor.toISOString().slice(0, 10)
    const dayOfWeek = cursor.getUTCDay()
    const isWorkingDay = dayOfWeek !== 0
    const daySessions = byDay.get(dateKey) ?? []

    if (isWorkingDay) totalWorkingDays += 1

    let firstLogin: string | undefined
    let lastLogout: string | undefined
    let totalMinutes = 0
    let hasOpenSession = false

    if (daySessions.length > 0) {
      const sortedByLogin = [...daySessions].sort((a, b) => new Date(a.loginAt).getTime() - new Date(b.loginAt).getTime())
      firstLogin = sortedByLogin[0]?.loginAt

      daySessions.forEach((session) => {
        const startAt = new Date(session.loginAt)
        const endAt = session.logoutAt ? new Date(session.logoutAt) : today

        if (!session.logoutAt) {
          hasOpenSession = true
        }

        if (!Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime()) && endAt > startAt) {
          totalMinutes += Math.floor((endAt.getTime() - startAt.getTime()) / 60000)
        }

        if (session.logoutAt) {
          if (!lastLogout || new Date(session.logoutAt) > new Date(lastLogout)) {
            lastLogout = session.logoutAt
          }
        }
      })
    }

    let status: 'present' | 'absent' | 'optional' | 'active'

    if (hasOpenSession) {
      status = 'active'
    } else if (isWorkingDay && daySessions.length > 0) {
      status = 'present'
    } else if (isWorkingDay && daySessions.length === 0) {
      status = 'absent'
    } else if (!isWorkingDay && daySessions.length > 0) {
      status = 'optional'
    } else {
      status = 'optional'
    }

    if (isWorkingDay && (status === 'present' || status === 'active')) {
      presentDays += 1
      totalMinutesInPresentDays += totalMinutes
    } else if (isWorkingDay && status === 'absent') {
      absentDays += 1
    }

    if (!isWorkingDay && daySessions.length > 0) {
      optionalDays += 1
    }

    days.push({
      date: dateKey,
      dayOfWeek,
      isWorkingDay,
      sessions: daySessions,
      firstLogin,
      lastLogout,
      totalMinutes,
      status,
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const attendancePercent = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0
  const avgHoursPerDay = presentDays > 0 ? totalMinutesInPresentDays / presentDays / 60 : 0

  return {
    month: safeMonth,
    presentDays,
    absentDays,
    optionalDays,
    totalWorkingDays,
    attendancePercent: Number(attendancePercent.toFixed(2)),
    avgHoursPerDay: Number(avgHoursPerDay.toFixed(2)),
    days,
  }
}

router.get('/members', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { role, status } = req.query as { role?: string; status?: string }

    const query: Record<string, unknown> = {}

    if (role && role.trim()) {
      const roleDoc = await Role.findOne({ name: role }).select('_id')
      if (roleDoc) query.roleId = roleDoc._id
    }

    if (status === 'active' || status === 'inactive') {
      query.status = status
    } else {
      query.status = { $in: ['active', 'inactive'] }
    }

    const users = await User.find(query)
      .populate('roleId', 'name')
      .select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')
      .sort({ name: 1 })

    return res.json({
      members: users.map((user) => serializeMember(user)),
      total: users.length,
    })
  } catch (error) {
    console.error('Team members error:', error)
    return res.status(500).json({ error: 'Failed to fetch team members' })
  }
})

router.get('/members/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })
    if (!canViewMember(auth.roleName, auth.userId, memberId)) return res.status(403).json({ error: 'Not allowed to view this profile' })

    const user = await User.findById(memberId).populate('roleId', 'name').select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')
    if (!user) return res.status(404).json({ error: 'Member not found' })

    return res.json({ member: serializeMember(user) })
  } catch (error) {
    console.error('Member detail error:', error)
    return res.status(500).json({ error: 'Failed to fetch member detail' })
  }
})

router.post('/members', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can create members' })

    const { name, email, phone, role, password } = req.body as {
      name?: string
      email?: string
      phone?: string
      role?: string
      password?: string
    }

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !role || !password) {
      return res.status(400).json({ error: 'name, email, phone, role and password are required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existing = await User.findOne({ email: normalizedEmail })

    const roleDoc = await Role.findOne({ name: role }).select('_id name')
    if (!roleDoc || roleDoc.name === 'admin') return res.status(400).json({ error: 'Invalid role for member creation' })

    const passwordHash = await hashPassword(password)

    // If this email was previously invited but not activated yet, convert it into
    // a fully active member instead of throwing duplicate-email conflict.
    if (existing) {
      const canUpgradeInvite = existing.status !== 'active' && existing.isEmailVerified === false
      if (!canUpgradeInvite) {
        return res.status(409).json({ error: 'Email already exists' })
      }

      existing.name = name.trim()
      existing.phone = phone.trim()
      existing.passwordHash = passwordHash
      existing.roleId = roleDoc._id
      existing.status = 'active'
      existing.isEmailVerified = true
      existing.createdBy = auth.userId as any
      await existing.save()

      const populatedExisting = await User.findById(existing._id).populate('roleId', 'name').select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')

      return res.status(200).json({ member: serializeMember(populatedExisting) })
    }

    const created = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
      roleId: roleDoc._id,
      status: 'active',
      isEmailVerified: true,
      createdBy: auth.userId,
    })

    const populated = await User.findById(created._id).populate('roleId', 'name').select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')

    return res.status(201).json({ member: serializeMember(populated) })
  } catch (error) {
    console.error('Create member error:', error)
    return res.status(500).json({ error: 'Failed to create member' })
  }
})

router.post('/invite', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can invite members' })

    const { email, role } = req.body as { email?: string; role?: string }

    if (!email?.trim() || !role) {
      return res.status(400).json({ error: 'email and role are required' })
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() })
    if (existing) return res.status(409).json({ error: 'Email already exists' })

    const roleDoc = await Role.findOne({ name: role }).select('_id name')
    if (!roleDoc || roleDoc.name === 'admin') return res.status(400).json({ error: 'Invalid role for invitation' })

    const temporaryPassword = Math.random().toString(36).slice(2, 12)
    const passwordHash = await hashPassword(temporaryPassword)

    await User.create({
      name: email.split('@')[0],
      email: email.trim().toLowerCase(),
      passwordHash,
      roleId: roleDoc._id,
      status: 'inactive',
      isEmailVerified: false,
      createdBy: auth.userId,
    })

    return res.status(201).json({
      success: true,
      email: email.trim().toLowerCase(),
      expiresInHours: 48,
    })
  } catch (error) {
    console.error('Invite member error:', error)
    return res.status(500).json({ error: 'Failed to invite member' })
  }
})

router.patch('/members/:id', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can update members' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })

    const { name, email, phone, role, status } = req.body as {
      name?: string
      email?: string
      phone?: string
      role?: string
      status?: 'active' | 'inactive'
    }

    const user = await User.findById(memberId)
    if (!user) return res.status(404).json({ error: 'Member not found' })

    if (typeof name === 'string' && name.trim()) user.name = name.trim()
    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase()
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).select('_id')
      if (existing) return res.status(409).json({ error: 'Email already exists' })
      user.email = normalizedEmail
    }
    if (typeof phone === 'string' && phone.trim()) user.phone = phone.trim()
    if (status === 'active' || status === 'inactive') user.status = status

    if (role && role.trim()) {
      const roleDoc = await Role.findOne({ name: role }).select('_id')
      if (roleDoc) user.roleId = roleDoc._id
    }

    await user.save()

    const populated = await User.findById(user._id).populate('roleId', 'name').select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')

    return res.json({ member: serializeMember(populated) })
  } catch (error) {
    console.error('Update member error:', error)
    return res.status(500).json({ error: 'Failed to update member' })
  }
})

router.patch('/members/:id/deactivate', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can deactivate members' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })

    const user = await User.findById(memberId)
    if (!user) return res.status(404).json({ error: 'Member not found' })

    user.status = 'inactive'
    await user.save()

    const populated = await User.findById(user._id).populate('roleId', 'name').select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')

    return res.json({ member: serializeMember(populated) })
  } catch (error) {
    console.error('Deactivate member error:', error)
    return res.status(500).json({ error: 'Failed to deactivate member' })
  }
})

router.patch('/members/:id/reactivate', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can reactivate members' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })

    const user = await User.findById(memberId)
    if (!user) return res.status(404).json({ error: 'Member not found' })

    user.status = 'active'
    await user.save()

    const populated = await User.findById(user._id).populate('roleId', 'name').select('name email phone avatarInitials roleId status isEmailVerified createdBy createdAt')

    return res.json({ member: serializeMember(populated) })
  } catch (error) {
    console.error('Reactivate member error:', error)
    return res.status(500).json({ error: 'Failed to reactivate member' })
  }
})

router.get('/members/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })
    if (!canViewMember(auth.roleName, auth.userId, memberId)) return res.status(403).json({ error: 'Not allowed to view this member stats' })

    const [leadsAssigned, followupsPending, projectsAssigned, proposalsSent] = await Promise.all([
      Lead.countDocuments({ assignedTo: memberId }),
      FollowUp.countDocuments({ assignedTo: memberId, isDone: false }),
      Project.countDocuments({ assignedTo: memberId }),
      Proposal.countDocuments({ createdBy: memberId, status: { $ne: 'Draft' } }),
    ])

    return res.json({ leadsAssigned, followupsPending, projectsAssigned, proposalsSent })
  } catch (error) {
    console.error('Member stats error:', error)
    return res.status(500).json({ error: 'Failed to fetch member stats' })
  }
})

router.get('/members/:id/activity', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })
    if (!canViewMember(auth.roleName, auth.userId, memberId)) return res.status(403).json({ error: 'Not allowed to view this member activity' })

    const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 50))

    const activities = await Activity.find({ actor: memberId }).sort({ createdAt: -1 }).limit(limit)

    return res.json({
      activities: activities.map((activity) => ({
        _id: String(activity._id),
        type: activity.type,
        description: activity.description,
        targetName: activity.targetName,
        createdAt: activity.createdAt,
      })),
    })
  } catch (error) {
    console.error('Member activity error:', error)
    return res.status(500).json({ error: 'Failed to fetch member activity' })
  }
})

router.get('/members/:id/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const memberId = getRouteId(req.params.id)
    if (!Types.ObjectId.isValid(memberId)) return res.status(400).json({ error: 'Invalid member id' })
    if (!canViewMember(auth.roleName, auth.userId, memberId)) return res.status(403).json({ error: 'Not allowed to view this member attendance' })

    const { month = new Date().toISOString().slice(0, 7) } = req.query as { month?: string }
    const bounds = monthBounds(month)

    const sessions = await UserSession.find({
      userId: memberId,
      loginAt: { $gte: bounds.start, $lt: bounds.end },
    }).select('_id userId loginAt logoutAt ipAddress userAgent createdAt').sort({ loginAt: 1 })

    const mapped: SessionLite[] = sessions.map((session) => ({
      _id: String(session._id),
      userId: String(session.userId),
      loginAt: (session.loginAt ?? session.createdAt).toISOString(),
      logoutAt: session.logoutAt ? session.logoutAt.toISOString() : undefined,
      ipAddress: session.ipAddress ?? undefined,
      userAgent: session.userAgent ?? undefined,
    }))

    const attendance = buildMonthlyAttendance(bounds.month, mapped)

    return res.json({ attendance })
  } catch (error) {
    console.error('Member attendance error:', error)
    return res.status(500).json({ error: 'Failed to fetch member attendance' })
  }
})

router.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can view team attendance' })

    const { month = new Date().toISOString().slice(0, 7) } = req.query as { month?: string }
    const bounds = monthBounds(month)

    const users = await User.find({ status: 'active' }).populate('roleId', 'name').select('_id name avatarInitials roleId')

    const sessions = await UserSession.find({
      userId: { $in: users.map((user) => user._id) },
      loginAt: { $gte: bounds.start, $lt: bounds.end },
    }).select('_id userId loginAt logoutAt ipAddress userAgent createdAt')

    const sessionsByUser = new Map<string, SessionLite[]>()
    sessions.forEach((session) => {
      const key = String(session.userId)
      if (!sessionsByUser.has(key)) sessionsByUser.set(key, [])
      sessionsByUser.get(key)?.push({
        _id: String(session._id),
        userId: key,
        loginAt: (session.loginAt ?? session.createdAt).toISOString(),
        logoutAt: session.logoutAt ? session.logoutAt.toISOString() : undefined,
        ipAddress: session.ipAddress ?? undefined,
        userAgent: session.userAgent ?? undefined,
      })
    })

    const members = users.map((user) => {
      const attendance = buildMonthlyAttendance(bounds.month, sessionsByUser.get(String(user._id)) ?? [])
      return {
        member: {
          _id: String(user._id),
          name: user.name,
          initials: user.avatarInitials || toInitials(user.name || 'NA'),
          role: toRoleName(user.roleId),
        },
        summary: {
          presentDays: attendance.presentDays,
          absentDays: attendance.absentDays,
          optionalDays: attendance.optionalDays,
          totalWorkingDays: attendance.totalWorkingDays,
          attendancePercent: attendance.attendancePercent,
          avgHoursPerDay: attendance.avgHoursPerDay,
        },
      }
    })

    return res.json({ month: bounds.month, members })
  } catch (error) {
    console.error('Team attendance error:', error)
    return res.status(500).json({ error: 'Failed to fetch team attendance' })
  }
})

router.get('/workload', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })
    if (!isAdmin(auth.roleName)) return res.status(403).json({ error: 'Only admins can view workload' })

    const users = await User.find({ status: 'active' }).populate('roleId', 'name').select('_id name avatarInitials roleId status')

    const members = await Promise.all(
      users.map(async (user) => {
        const memberId = String(user._id)

        const [leadsAssigned, followupsPending, projectsAssigned, proposalsSent] = await Promise.all([
          Lead.countDocuments({ assignedTo: memberId }),
          FollowUp.countDocuments({ assignedTo: memberId, isDone: false }),
          Project.countDocuments({ assignedTo: memberId }),
          Proposal.countDocuments({ createdBy: memberId, status: { $ne: 'Draft' } }),
        ])

        return {
          member: {
            _id: memberId,
            name: user.name,
            initials: user.avatarInitials || toInitials(user.name || 'NA'),
            role: toRoleName(user.roleId),
            status: user.status === 'active' ? 'active' : 'inactive',
          },
          leadsAssigned,
          followupsPending,
          projectsAssigned,
          proposalsSent,
        }
      }),
    )

    return res.json({ members })
  } catch (error) {
    console.error('Workload overview error:', error)
    return res.status(500).json({ error: 'Failed to fetch workload overview' })
  }
})

export default router
