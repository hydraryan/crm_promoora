import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Activity } from '../models/Activity.js'
import { getAuthContext } from './_helpers.js'

const router = Router()

router.use(authenticateToken)

router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const query: Record<string, unknown> = { createdAt: { $gte: start, $lt: end } }

    if (auth.roleName !== 'admin') {
      query.actor = auth.userId
    }

    const activities = await Activity.find(query).populate('actor', 'name avatarInitials').sort({ createdAt: -1 })

    return res.json({
      activities: activities.map((activity) => ({
        _id: activity._id,
        actor: {
          _id: (((activity.actor as { _id?: unknown } | undefined)?._id ?? activity.actor) as { toString: () => string }).toString(),
          name: (activity.actor as { name?: string })?.name ?? 'Unknown',
          initials: (activity.actor as { avatarInitials?: string })?.avatarInitials ?? 'NA',
        },
        type: activity.type,
        description: activity.description,
        targetName: activity.targetName,
        targetId: activity.targetId,
        createdAt: activity.createdAt,
      })),
      totalToday: activities.length,
    })
  } catch (error) {
    console.error('Today activity error:', error)
    return res.status(500).json({ error: 'Failed to fetch today activity' })
  }
})

export default router
