import { Router, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Notification } from '../models/Notification.js'
import { emitUnreadCount, subscribeToNotifications } from '../services/notifications.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}

function serializeNotification(item: any) {
  return {
    _id: item._id.toString(),
    category: item.category,
    title: item.title,
    message: item.message,
    actionUrl: item.actionUrl,
    isRead: item.isRead,
    createdAt: item.createdAt,
  }
}

router.get('/stream', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) return res.status(401).json({ error: 'Access token required' })

  let payload: { userId?: string }
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId?: string }
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }

  if (!payload.userId) return res.status(403).json({ error: 'Invalid token payload' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const unsubscribe = subscribeToNotifications(payload.userId, res)

  void emitUnreadCount(payload.userId)

  req.on('close', () => {
    unsubscribe()
    res.end()
  })
})

router.use(authenticateToken)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100)

    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ userId, isRead: false }),
    ])

    return res.json({
      notifications: items.map((item) => serializeNotification(item)),
      unreadCount,
    })
  } catch (error) {
    console.error('Notifications list error:', error)
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const updated = await Notification.findOneAndUpdate({ _id: req.params.id, userId }, { isRead: true }, { new: true })

    if (!updated) return res.status(404).json({ error: 'Notification not found' })

    await emitUnreadCount(userId)

    return res.json({ success: true, notification: serializeNotification(updated) })
  } catch (error) {
    console.error('Notification read error:', error)
    return res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    await Notification.updateMany({ userId, isRead: false }, { isRead: true })
    await emitUnreadCount(userId)

    return res.json({ success: true })
  } catch (error) {
    console.error('Notification mark-all-read error:', error)
    return res.status(500).json({ error: 'Failed to mark all notifications as read' })
  }
})

export default router