import { Router, type Response } from 'express'
import { Types } from 'mongoose'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Activity } from '../models/Activity.js'
import { FollowUp } from '../models/FollowUp.js'
import { Lead } from '../models/Lead.js'
import { User } from '../models/User.js'
import { getAuthContext, isAdmin } from './_helpers.js'

const router = Router()

router.use(authenticateToken)

async function buildPerformance(userId: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const userObjectId = new Types.ObjectId(userId)

  const [user, monthActivityBreakdown, monthFollowUpsDone, wonDeals, lostDeals] = await Promise.all([
    User.findById(userId).populate('roleId', 'name'),
    Activity.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          actor: userObjectId,
          createdAt: { $gte: monthStart },
          type: { $in: ['lead_created', 'stage_changed', 'proposal_sent'] },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]),
    FollowUp.countDocuments({ assignedTo: userId, isDone: true, doneAt: { $gte: monthStart } }),
    Lead.countDocuments({ assignedTo: userId, stage: 'Won', updatedAt: { $gte: monthStart } }),
    Lead.countDocuments({ assignedTo: userId, stage: 'Lost', updatedAt: { $gte: monthStart } }),
  ])

  const monthCounts = new Map(monthActivityBreakdown.map((row) => [row._id, row.count]))
  const leadsContacted = (monthCounts.get('lead_created') ?? 0) + (monthCounts.get('stage_changed') ?? 0)
  const proposalsSent = monthCounts.get('proposal_sent') ?? 0
  const conversionRate = leadsContacted > 0 ? Number(((wonDeals / leadsContacted) * 100).toFixed(1)) : 0

  const trendStart = new Date(todayStart)
  trendStart.setDate(todayStart.getDate() - 6)

  const [leadTrendRows, followupTrendRows] = await Promise.all([
    Activity.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          actor: userObjectId,
          type: { $in: ['lead_created', 'stage_changed'] },
          createdAt: { $gte: trendStart, $lt: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    FollowUp.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          assignedTo: userObjectId,
          isDone: true,
          doneAt: { $gte: trendStart, $lt: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$doneAt',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  const leadTrendMap = new Map(leadTrendRows.map((row) => [row._id, row.count]))
  const followupTrendMap = new Map(followupTrendRows.map((row) => [row._id, row.count]))

  const trend = Array.from({ length: 7 }).map((_, idx) => {
    const day = new Date(todayStart)
    day.setDate(todayStart.getDate() - (6 - idx))
    const dayKey = day.toISOString().slice(0, 10)

    return {
      date: dayKey,
      leadsContacted: leadTrendMap.get(dayKey) ?? 0,
      followUpsDone: followupTrendMap.get(dayKey) ?? 0,
    }
  })

  const topLeadDoc = await Lead.findOne({ assignedTo: userId, stage: { $in: ['Negotiation', 'Won'] } })
    .select('businessName stage')
    .sort({ updatedAt: -1 })
    .lean()

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
