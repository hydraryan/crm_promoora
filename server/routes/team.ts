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
import { createNotification } from '../services/notifications.js'
import { sendWelcomeMemberEmail } from '../services/mailer.js'

const router = Router()
router.use(authenticateToken)

type RoleName = string

type SessionLite = {
  _id: string
  userId: string
  loginAt: string
  logoutAt?: string
  activeMs?: number
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
  const [yearText, monthText] = safeMonth.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText)
  const nextMonthIndex = monthIndex === 12 ? 1 : monthIndex + 1
  const nextMonthYear = monthIndex === 12 ? year + 1 : year

  const start = new Date(`${safeMonth}-01T00:00:00+05:30`)
  const end = new Date(`${String(nextMonthYear).padStart(4, '0')}-${String(nextMonthIndex).padStart(2, '0')}-01T00:00:00+05:30`)

  return { month: safeMonth, start, end }
}

function formatDayKeyIST(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(value)
}

function dayStartISTUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+05:30`)
}

function dayEndISTUtcExclusive(dateKey: string): Date {
  return new Date(dayStartISTUtc(dateKey).getTime() + 24 * 60 * 60 * 1000)
}

function listMonthDateKeys(month: string): string[] {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText)

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return []
  }

  const totalDays = new Date(year, monthIndex, 0).getDate()
  const keys: string[] = []

  for (let day = 1; day <= totalDays; day += 1) {
    keys.push(`${yearText}-${monthText}-${String(day).padStart(2, '0')}`)
  }

  return keys
}

function buildMonthlyAttendance(month: string, sessions: SessionLite[]) {
  const { month: safeMonth } = monthBounds(month)
  const today = new Date()
  const todayKey = formatDayKeyIST(today)
  const monthKeys = listMonthDateKeys(safeMonth)

  const openSessions = sessions.filter((session) => !session.logoutAt)
  const latestOpenSessionId =
    openSessions.length > 0
      ? [...openSessions].sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime())[0]?._id
      : undefined

  const normalizedSessions = sessions.filter((session) => session.logoutAt || session._id === latestOpenSessionId)

  const days: Array<{
    date: string
    dayOfWeek: number
    isWorkingDay: boolean
    sessions: SessionLite[]
    firstLogin?: string
    lastLogout?: string
    totalMinutes: number
    loginMinutes: number
    activeMinutes: number
    productivityRatio: number
    status: 'present' | 'absent' | 'optional' | 'active'
  }> = []

  let presentDays = 0
  let absentDays = 0
  let optionalDays = 0
  let totalWorkingDays = 0
  let totalLoginMinutesInPresentDays = 0
  let totalActiveMinutesInPresentDays = 0

  for (const dateKey of monthKeys) {
    const dayOfWeek = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
    const isWorkingDay = dayOfWeek !== 0
    const dayStart = dayStartISTUtc(dateKey)
    const dayEndExclusive = dayEndISTUtcExclusive(dateKey)

    if (isWorkingDay) totalWorkingDays += 1

    let firstLogin: string | undefined
    let lastLogout: string | undefined
    let totalLoginMs = 0
    let totalActiveMs = 0
    let hasOpenSession = false

    const daySessions = normalizedSessions.filter((session) => {
      const startAt = new Date(session.loginAt)
      const endAt = session.logoutAt ? new Date(session.logoutAt) : today

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return false
      return startAt < dayEndExclusive && endAt > dayStart
    })

    for (const session of daySessions) {
      const startAt = new Date(session.loginAt)
      const rawEndAt = session.logoutAt ? new Date(session.logoutAt) : today

      const overlapStart = new Date(Math.max(startAt.getTime(), dayStart.getTime()))
      const overlapEnd = new Date(Math.min(rawEndAt.getTime(), dayEndExclusive.getTime()))

      if (overlapEnd <= overlapStart) continue

      const overlapMs = overlapEnd.getTime() - overlapStart.getTime()
      totalLoginMs += overlapMs

      if (!firstLogin || startAt < new Date(firstLogin)) {
        firstLogin = startAt.toISOString()
      }

      if (session.logoutAt) {
        const logout = new Date(session.logoutAt)
        if (logout >= dayStart && logout <= dayEndExclusive) {
          if (!lastLogout || logout > new Date(lastLogout)) {
            lastLogout = logout.toISOString()
          }
        }
      }

      if (!session.logoutAt && dateKey === todayKey) {
        hasOpenSession = true
      }

      const sessionDurationMs = Math.max(0, rawEndAt.getTime() - startAt.getTime())
      const sessionActiveMs = Math.max(0, session.activeMs ?? 0)

      if (sessionDurationMs > 0 && sessionActiveMs > 0) {
        const proportionalActive = (sessionActiveMs * overlapMs) / sessionDurationMs
        totalActiveMs += proportionalActive
      }
    }

    // Defensive cap: one calendar day cannot exceed 24 hours of tracked duration.
    totalLoginMs = Math.min(totalLoginMs, 24 * 60 * 60 * 1000)
    totalActiveMs = Math.min(totalActiveMs, totalLoginMs)

    const totalMinutes = Math.round(totalLoginMs / 60000)
    const activeMinutes = Math.round(totalActiveMs / 60000)
    const productivityRatio = totalMinutes > 0 ? Number((activeMinutes / totalMinutes).toFixed(2)) : 0

    let status: 'present' | 'absent' | 'optional' | 'active'

    if (hasOpenSession) {
      status = 'active'
    } else if (isWorkingDay && totalMinutes > 0) {
      status = 'present'
    } else if (isWorkingDay && totalMinutes === 0) {
      status = 'absent'
    } else if (!isWorkingDay && totalMinutes > 0) {
      status = 'optional'
    } else {
      status = 'optional'
    }

    if (isWorkingDay && (status === 'present' || status === 'active')) {
      presentDays += 1
      totalLoginMinutesInPresentDays += totalMinutes
      totalActiveMinutesInPresentDays += activeMinutes
    } else if (isWorkingDay && status === 'absent') {
      absentDays += 1
    }

    if (!isWorkingDay && totalMinutes > 0) {
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
      loginMinutes: totalMinutes,
      activeMinutes,
      productivityRatio,
      status,
    })
  }

  const attendancePercent = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0
  const avgHoursPerDay = presentDays > 0 ? totalLoginMinutesInPresentDays / presentDays / 60 : 0
  const avgActiveHoursPerDay = presentDays > 0 ? totalActiveMinutesInPresentDays / presentDays / 60 : 0
  const productivityRatio = totalLoginMinutesInPresentDays > 0 ? totalActiveMinutesInPresentDays / totalLoginMinutesInPresentDays : 0

  return {
    month: safeMonth,
    presentDays,
    absentDays,
    optionalDays,
    totalWorkingDays,
    attendancePercent: Number(attendancePercent.toFixed(2)),
    avgHoursPerDay: Number(avgHoursPerDay.toFixed(2)),
    avgActiveHoursPerDay: Number(avgActiveHoursPerDay.toFixed(2)),
    loginMinutes: totalLoginMinutesInPresentDays,
    activeMinutes: totalActiveMinutesInPresentDays,
    productivityRatio: Number(productivityRatio.toFixed(2)),
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

      const mailResult = await sendWelcomeMemberEmail(existing.email, existing.name, password)
      if (!mailResult.sent) {
        return res.status(500).json({ error: `Member created but welcome email failed: ${mailResult.reason ?? 'Unknown error'}` })
      }

      await createNotification({
        userId: String(existing._id),
        category: 'team',
        title: 'Account Activated',
        message: 'Your CRM account has been activated by admin',
        actionUrl: '/team/list',
      })

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

    const mailResult = await sendWelcomeMemberEmail(created.email, created.name, password)
    if (!mailResult.sent) {
      return res.status(500).json({ error: `Member created but welcome email failed: ${mailResult.reason ?? 'Unknown error'}` })
    }

    await createNotification({
      userId: String(created._id),
      category: 'team',
      title: 'Welcome to CRM Portal',
      message: 'Your team account is ready. Sign in to start working.',
      actionUrl: '/dashboard',
    })

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

    await createNotification({
      userId: auth.userId,
      category: 'team',
      title: 'Invitation Sent',
      message: `${email.trim().toLowerCase()} invited as ${role}`,
      actionUrl: '/team/list',
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

    await createNotification({
      userId: String(user._id),
      category: 'team',
      title: 'Account Deactivated',
      message: 'Your account was set to inactive by admin',
      actionUrl: '/dashboard',
    })

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

    await createNotification({
      userId: String(user._id),
      category: 'team',
      title: 'Account Reactivated',
      message: 'Your account was reactivated by admin',
      actionUrl: '/dashboard',
    })

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

router.post('/attendance/engagement', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const { activeMs } = req.body as { activeMs?: number }
    if (typeof activeMs !== 'number' || !Number.isFinite(activeMs)) {
      return res.status(400).json({ error: 'activeMs must be a number' })
    }

    const clampedActiveMs = Math.max(0, Math.min(Math.floor(activeMs), 5 * 60 * 1000))
    if (clampedActiveMs === 0) {
      return res.json({ success: true })
    }

    const currentSession = await UserSession.findOne(
      {
        userId: auth.userId,
        $or: [{ logoutAt: { $exists: false } }, { logoutAt: null }],
      },
      {},
      { sort: { loginAt: -1 } },
    )

    if (!currentSession) {
      return res.json({ success: true })
    }

    currentSession.activeMs = Math.max(0, (currentSession.activeMs ?? 0) + clampedActiveMs)
    currentSession.lastActiveAt = new Date()
    currentSession.lastEngagementAt = new Date()
    await currentSession.save()

    return res.json({ success: true })
  } catch (error) {
    console.error('Attendance engagement update error:', error)
    return res.status(500).json({ error: 'Failed to update engagement metrics' })
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
      loginAt: { $lt: bounds.end },
      $or: [{ logoutAt: { $gte: bounds.start } }, { logoutAt: { $exists: false } }, { logoutAt: null }],
    }).select('_id userId loginAt logoutAt activeMs ipAddress userAgent createdAt').sort({ loginAt: 1 })

    const mapped: SessionLite[] = sessions.map((session) => ({
      _id: String(session._id),
      userId: String(session.userId),
      loginAt: (session.loginAt ?? session.createdAt).toISOString(),
      logoutAt: session.logoutAt ? session.logoutAt.toISOString() : undefined,
      activeMs: session.activeMs ?? 0,
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
      loginAt: { $lt: bounds.end },
      $or: [{ logoutAt: { $gte: bounds.start } }, { logoutAt: { $exists: false } }, { logoutAt: null }],
    }).select('_id userId loginAt logoutAt activeMs ipAddress userAgent createdAt')

    const sessionsByUser = new Map<string, SessionLite[]>()
    sessions.forEach((session) => {
      const key = String(session.userId)
      if (!sessionsByUser.has(key)) sessionsByUser.set(key, [])
      sessionsByUser.get(key)?.push({
        _id: String(session._id),
        userId: key,
        loginAt: (session.loginAt ?? session.createdAt).toISOString(),
        logoutAt: session.logoutAt ? session.logoutAt.toISOString() : undefined,
        activeMs: session.activeMs ?? 0,
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
          avgActiveHoursPerDay: attendance.avgActiveHoursPerDay,
          loginMinutes: attendance.loginMinutes,
          activeMinutes: attendance.activeMinutes,
          productivityRatio: attendance.productivityRatio,
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
