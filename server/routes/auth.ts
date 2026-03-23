import { Router, type Request, type Response } from 'express'
import { User } from '../models/User'
import { UserSession } from '../models/UserSession'
import { comparePassword, hashPassword } from '../models/seed'
import { generateAccessToken, generateRefreshToken, authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

/**
 * POST /auth/login
 * Authenticate user with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, deviceId, userAgent } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Find user (include passwordHash with select: false) and populate roleId
    const user = await User.findOne({ email }).select('+passwordHash').populate('roleId')

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' })
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash)

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Extract role name (handle both populated and unpopulated roleId)
    let roleName = 'viewer'
    if (user.roleId) {
      const roleDoc = user.roleId as any
      if (roleDoc && typeof roleDoc === 'object' && 'name' in roleDoc) {
        roleName = roleDoc.name
      }
    }

    // Update last login
    user.lastLoginAt = new Date()
    await user.save()

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.email)
    const refreshToken = generateRefreshToken(user._id.toString(), user.email)

    // Hash refresh token before storing
    const refreshTokenHash = await hashPassword(refreshToken)

    // Create session
    const session = await UserSession.create({
      userId: user._id,
      refreshTokenHash,
      userAgent: userAgent || 'unknown',
      deviceId: deviceId || 'unknown',
      loginAt: new Date(),
      ipAddress: req.ip,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })

    // Return tokens and user info
    console.log(`✅ User logged in: ${user.email} with role: ${roleName}`)
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarInitials: user.avatarInitials,
        role: roleName,
        status: user.status,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' })
    }

    // Find session by refresh token hash
    // Note: In production, decode JWT first without verification, then verify against stored hash
    const session = await UserSession.findOne({
      expiresAt: { $gt: new Date() },
    }).populate('userId')

    if (!session) {
      return res.status(403).json({ error: 'Session expired or invalid' })
    }

    const user = session.userId as any

    // Verify refresh token against session hash
    const isValid = await comparePassword(refreshToken, session.refreshTokenHash)

    if (!isValid) {
      return res.status(403).json({ error: 'Invalid refresh token' })
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id.toString(), user.email)

    res.json({
      success: true,
      accessToken: newAccessToken,
    })
  } catch (error) {
    console.error('Refresh error:', error)
    res.status(500).json({ error: 'Token refresh failed' })
  }
})

/**
 * POST /auth/logout
 * Logout user and delete session
 */
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Keep session history for attendance, but close open sessions and expire refresh tokens.
    await UserSession.updateMany(
      {
        userId: req.user.userId,
        $or: [{ logoutAt: { $exists: false } }, { logoutAt: null }],
      },
      {
        $set: {
          logoutAt: new Date(),
          lastActiveAt: new Date(),
          expiresAt: new Date(),
        },
      },
    )

    res.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Logout failed' })
  }
})

/**
 * POST /auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }

    const user = await User.findById(req.user.userId).select('+passwordHash')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const isValidCurrent = await comparePassword(currentPassword, user.passwordHash)
    if (!isValidCurrent) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    user.passwordHash = await hashPassword(newPassword)
    await user.save()

    return res.json({ success: true, message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return res.status(500).json({ error: 'Failed to change password' })
  }
})

/**
 * GET /auth/me
 * Get current user and their permission matrix
 */
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(req.user.userId).populate('roleId')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const roleDoc = (user.roleId as any)

    const toMatrix = (role: any) => {
      const CRM_MODULES = ['leads', 'clients', 'projects', 'followups', 'proposals', 'invoicing', 'team', 'communication', 'reports', 'settings'] as const
      const ACTIONS = ['view', 'create', 'edit', 'delete'] as const
      const result = Object.fromEntries(
        CRM_MODULES.map((m) => [m, { view: false, create: false, edit: false, delete: false }]),
      )

      const raw = role.permissions as Record<string, string[]>

      const normalizeAction = (a: string) => {
        if (a === 'view' || a === 'read') return 'view'
        if (a === 'create') return 'create'
        if (a === 'edit' || a === 'update') return 'edit'
        if (a === 'delete') return 'delete'
        return null
      }

      CRM_MODULES.forEach((module) => {
        const storageKey = module === 'invoicing' ? 'invoices' : module
        const aliases = module === 'invoicing' ? ['invoicing', 'invoices'] : [storageKey]
        const actions = aliases.flatMap((key) => raw?.[key] ?? [])

        actions.forEach((action) => {
          const normalized = normalizeAction(action)
          if (normalized && ACTIONS.includes(normalized as any)) {
            result[module][normalized] = true
          }
        })
      })

      return result
    }

    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: roleDoc?.name ?? 'viewer',
      },
      permissions: toMatrix(roleDoc),
      disabledModules: roleDoc?.disabledModules ?? [],
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return res.status(500).json({ error: 'Failed to fetch current user' })
  }
})

export default router
