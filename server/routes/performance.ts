import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth'
import { Activity } from '../models/Activity'
import { FollowUp } from '../models/FollowUp'
import { Lead } from '../models/Lead'
import { User } from '../models/User'
import { getAuthContext, isAdmin } from './_helpers'

const router = Router()

router.use(authenticateToken)

async function buildPerformance(userId: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const [user, monthActivities, monthFollowUpsDone, wonDeals, lostDeals] = await Promise.all([
    User.findById(userId).populate('roleId', 'name'),
    Activity.find({ actor: userId, createdAt: { $gte: monthStart } }).sort({ createdAt: -1 }),
    FollowUp.countDocuments({ assignedTo: userId, isDone: true, doneAt: { $gte: monthStart } }),
    Lead.countDocuments({ assignedTo: userId, stage: 'Won', updatedAt: { $gte: monthStart } }),
    Lead.countDocuments({ assignedTo: userId, stage: 'Lost', updatedAt: { $gte: monthStart } }),
  ])

  const leadsContacted = monthActivities.filter((a) => a.type === 'lead_created' || a.type === 'stage_changed').length
  const proposalsSent = monthActivities.filter((a) => a.type === 'proposal_sent').length
  const conversionRate = leadsContacted > 0 ? Number(((wonDeals / leadsContacted) * 100).toFixed(1)) : 0

  const trend = await Promise.all(
    Array.from({ length: 7 }).map(async (_, idx) => {
      const day = new Date(todayStart)
      day.setDate(todayStart.getDate() - (6 - idx))
      const dayEnd = new Date(day)
      dayEnd.setDate(day.getDate() + 1)

      const [dailyLeads, dailyFollowups] = await Promise.all([
        Activity.countDocuments({
          actor: userId,
          type: { $in: ['lead_created', 'stage_changed'] },
          createdAt: { $gte: day, $lt: dayEnd },
        }),
        FollowUp.countDocuments({ assignedTo: userId, isDone: true, doneAt: { $gte: day, $lt: dayEnd } }),
      ])

      return {
        date: day.toISOString().slice(0, 10),
        leadsContacted: dailyLeads,
        followUpsDone: dailyFollowups,
      }
    })
  )

  const topLeadDoc = await Lead.findOne({ assignedTo: userId, stage: { $in: ['Negotiation', 'Won'] } }).sort({ updatedAt: -1 })

  return {
    user: {
      name: user?.name ?? 'Unknown',
      initials: user?.avatarInitials ?? 'NA',
      role: ((user?.roleId as { name?: string })?.name ?? 'viewer') as string,
    },
    currentMonth: {
      leadsContacted,
      proposalsSent,
      followUpsDone: monthFollowUpsDone,
      dealsWon: wonDeals,
      dealsLost: lostDeals,
      conversionRate,
    },
    trend,
    topLead: topLeadDoc
      ? {
          businessName: topLeadDoc.businessName,
          stage: topLeadDoc.stage,
        }
      : null,
  }
}

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    if (auth.roleName !== 'admin' && auth.roleName !== 'bd_intern') {
      return res.status(403).json({ error: 'Performance tracking is available for BD team members.' })
    }

    const data = await buildPerformance(auth.userId)
    return res.json(data)
  } catch (error) {
    console.error('My performance error:', error)
    return res.status(500).json({ error: 'Failed to fetch performance data' })
  }
})

router.get('/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    if (!isAdmin(auth.roleName)) {
      return res.status(403).json({ error: 'Only admins can view other user performance' })
    }

    const requestedUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId
    const data = await buildPerformance(requestedUserId)
    return res.json(data)
  } catch (error) {
    console.error('User performance error:', error)
    return res.status(500).json({ error: 'Failed to fetch user performance data' })
  }
})

export default router
