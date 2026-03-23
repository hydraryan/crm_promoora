import { Router, type Response } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth'
import { Lead } from '../models/Lead'
import { User } from '../models/User'
import { Proposal } from '../models/Proposal'
import { FollowUp } from '../models/FollowUp'
import { InvoiceModel } from '../models/Invoice'
import { Activity } from '../models/Activity'
import { getAuthContext, isAdmin } from './_helpers'

const router = Router()

const STAGE_ORDER = ['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation', 'Won', 'Lost']

router.use(authenticateToken)

function toDateRange(from?: string, to?: string) {
  const now = new Date()
  const fallbackTo = now.toISOString().slice(0, 10)
  const toDate = new Date(`${to ?? fallbackTo}T23:59:59.999Z`)

  const fallbackFrom = new Date(toDate)
  fallbackFrom.setDate(fallbackFrom.getDate() - 30)

  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : fallbackFrom
  return { from: fromDate, to: toDate }
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'short' })
}

function monthKeysBetween(from: Date, to: Date) {
  const keys: string[] = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  while (cursor <= end) {
    keys.push(monthKey(cursor))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return keys
}

function normalizeFollowupType(type?: string): 'Phone call' | 'WhatsApp' | 'Walk-in' {
  if (!type) return 'Phone call'
  const lower = type.toLowerCase()
  if (lower.includes('whatsapp')) return 'WhatsApp'
  if (lower.includes('walk')) return 'Walk-in'
  return 'Phone call'
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
}

async function requireAdmin(req: AuthRequest, res: Response) {
  const auth = await getAuthContext(req)
  if (!auth) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }
  if (!isAdmin(auth.roleName)) {
    res.status(403).json({ error: 'Reports are available to admins only.' })
    return null
  }
  return auth
}

router.get('/lead-conversion', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const { from: fromRaw, to: toRaw } = req.query as { from?: string; to?: string }
    const { from, to } = toDateRange(fromRaw, toRaw)

    const [leadsInRange, convertedInRange] = await Promise.all([
      Lead.find({ createdAt: { $gte: from, $lte: to } }).select('stage source createdAt updatedAt'),
      Lead.find({ stage: 'Won', updatedAt: { $gte: from, $lte: to } }).select('source createdAt updatedAt'),
    ])

    const totalLeads = leadsInRange.length
    const totalConverted = convertedInRange.length
    const conversionRate = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0
    const avgDaysToConvert =
      convertedInRange.length > 0
        ? convertedInRange.reduce((sum, lead) => sum + daysBetween(lead.createdAt, lead.updatedAt), 0) / convertedInRange.length
        : 0

    const monthKeys = monthKeysBetween(from, to)

    const monthlyTrend = monthKeys.map((key) => {
      const added = leadsInRange.filter((lead) => monthKey(lead.createdAt) === key).length
      const converted = convertedInRange.filter((lead) => monthKey(lead.updatedAt) === key).length
      return {
        month: monthLabel(key),
        added,
        converted,
      }
    })

    const stageOrder = ['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation', 'Won']
    const stageCounts = stageOrder.map((stage) => ({
      stage,
      count: leadsInRange.filter((lead) => lead.stage === stage).length,
    }))

    const stageFunnel = stageCounts.map((row, idx) => {
      if (idx === stageCounts.length - 1 || row.count === 0) {
        return { stage: row.stage, count: row.count, dropOffRate: 0 }
      }
      const progressed = stageCounts[idx + 1].count
      const dropOffRate = row.count > 0 ? Math.max(0, ((row.count - progressed) / row.count) * 100) : 0
      return { stage: row.stage, count: row.count, dropOffRate }
    })

    const sources = ['walk_in', 'referral', 'instagram', 'cold_call', 'other']
    const sourceBreakdown = sources.map((source) => {
      const sourceLeads = leadsInRange.filter((lead) => (lead.source ?? 'other') === source)
      const converted = sourceLeads.filter((lead) => lead.stage === 'Won').length
      const count = sourceLeads.length
      return {
        source,
        count,
        converted,
        conversionRate: count > 0 ? (converted / count) * 100 : 0,
      }
    })

    return res.json({
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      summary: { totalLeads, totalConverted, conversionRate, avgDaysToConvert },
      monthlyTrend,
      stageFunnel,
      sourceBreakdown,
    })
  } catch (error) {
    console.error('Lead conversion report error:', error)
    return res.status(500).json({ error: 'Failed to fetch lead conversion report' })
  }
})

router.get('/pipeline', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const { from: fromRaw, to: toRaw } = req.query as { from?: string; to?: string }
    const { from, to } = toDateRange(fromRaw, toRaw)

    const [leads, staleLeads, wonRange] = await Promise.all([
      Lead.find({ createdAt: { $gte: from, $lte: to } }).populate('assignedTo', 'name avatarInitials').select('businessName stage lastActivityAt createdAt updatedAt assignedTo'),
      Lead.find({ stage: { $nin: ['Won', 'Lost'] }, lastActivityAt: { $lte: new Date(Date.now() - 14 * 86400000) } })
        .populate('assignedTo', 'name avatarInitials')
        .select('businessName stage lastActivityAt assignedTo')
        .limit(20),
      Lead.find({ stage: 'Won', updatedAt: { $gte: from, $lte: to } }).select('createdAt updatedAt'),
    ])

    const activeLeads = leads.filter((lead) => lead.stage !== 'Won' && lead.stage !== 'Lost')
    const totalActive = activeLeads.length
    const totalWon = leads.filter((lead) => lead.stage === 'Won').length
    const totalLost = leads.filter((lead) => lead.stage === 'Lost').length
    const winRate = totalWon + totalLost > 0 ? (totalWon / (totalWon + totalLost)) * 100 : 0

    const stages = ['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation']
    const stageDistribution = stages.map((stage) => {
      const inStage = activeLeads.filter((lead) => lead.stage === stage)
      const avgDaysInStage =
        inStage.length > 0
          ? inStage.reduce((sum, lead) => sum + daysBetween(lead.lastActivityAt ?? lead.updatedAt, new Date()), 0) / inStage.length
          : 0

      return {
        stage,
        count: inStage.length,
        percent: totalActive > 0 ? (inStage.length / totalActive) * 100 : 0,
        avgDaysInStage,
      }
    })

    const velocityDays = wonRange.map((lead) => daysBetween(lead.createdAt, lead.updatedAt))
    const velocity = {
      avgTotalDays: velocityDays.length ? velocityDays.reduce((sum, v) => sum + v, 0) / velocityDays.length : 0,
      fastestClose: velocityDays.length ? Math.min(...velocityDays) : 0,
      slowestClose: velocityDays.length ? Math.max(...velocityDays) : 0,
    }

    const stagnant = staleLeads.map((lead) => ({
      _id: lead._id.toString(),
      businessName: lead.businessName,
      stage: lead.stage,
      daysSinceActivity: daysBetween(lead.lastActivityAt ?? new Date(), new Date()),
      assignedTo: {
        name: (lead.assignedTo as { name?: string })?.name ?? 'Unknown',
        initials: (lead.assignedTo as { avatarInitials?: string })?.avatarInitials ?? 'NA',
      },
    }))

    return res.json({
      summary: { totalActive, totalWon, totalLost, winRate },
      stageDistribution,
      velocity,
      stagnant,
    })
  } catch (error) {
    console.error('Pipeline report error:', error)
    return res.status(500).json({ error: 'Failed to fetch pipeline report' })
  }
})

router.get('/revenue', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const { from: fromRaw, to: toRaw } = req.query as { from?: string; to?: string }
    const { from, to } = toDateRange(fromRaw, toRaw)

    const invoices = await InvoiceModel.find({ invoiceDate: { $gte: from, $lte: to } }).populate('clientId', 'businessName').select('invoiceDate totalAmount status clientId')

    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    const totalCollected = invoices.filter((invoice) => invoice.status === 'Paid').reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    const totalOutstanding = invoices.filter((invoice) => invoice.status !== 'Paid').reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    const totalOverdue = invoices.filter((invoice) => invoice.status === 'Overdue').reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0

    const monthKeys = monthKeysBetween(from, to)
    const monthlyTrend = monthKeys.map((key) => {
      const monthInvoices = invoices.filter((invoice) => monthKey(invoice.invoiceDate) === key)
      return {
        month: monthLabel(key),
        invoiced: monthInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0),
        collected: monthInvoices.filter((invoice) => invoice.status === 'Paid').reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0),
      }
    })

    const clientGroups = new Map<string, { clientName: string; totalInvoiced: number; totalPaid: number; invoiceCount: number }>()
    invoices.forEach((invoice) => {
      const clientId = ((invoice.clientId as { _id?: { toString: () => string } })?._id?.toString() ?? 'unknown')
      const clientName = (invoice.clientId as { businessName?: string })?.businessName ?? 'Unknown client'

      const current = clientGroups.get(clientId) ?? { clientName, totalInvoiced: 0, totalPaid: 0, invoiceCount: 0 }
      current.totalInvoiced += Number(invoice.totalAmount || 0)
      current.invoiceCount += 1
      if (invoice.status === 'Paid') {
        current.totalPaid += Number(invoice.totalAmount || 0)
      }
      clientGroups.set(clientId, current)
    })

    const topClients = [...clientGroups.values()].sort((a, b) => b.totalPaid - a.totalPaid)

    const invoiceStatusBreakdown = (['Paid', 'Unpaid', 'Overdue'] as const).map((status) => {
      const rows = invoices.filter((invoice) => invoice.status === status)
      return {
        status,
        count: rows.length,
        amount: rows.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0),
      }
    })

    return res.json({
      summary: { totalInvoiced, totalCollected, totalOutstanding, totalOverdue, collectionRate },
      monthlyTrend,
      topClients,
      invoiceStatusBreakdown,
    })
  } catch (error) {
    console.error('Revenue report error:', error)
    return res.status(500).json({ error: 'Failed to fetch revenue report' })
  }
})

router.get('/bd-performance', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const { from: fromRaw, to: toRaw } = req.query as { from?: string; to?: string }
    const { from, to } = toDateRange(fromRaw, toRaw)

    const users = await User.find({ status: 'active' }).populate('roleId', 'name').select('name avatarInitials roleId')
    const members = users.filter((user) => {
      const roleName = (user.roleId as { name?: string })?.name
      return roleName === 'bd_intern' || roleName === 'admin'
    })

    const rows = await Promise.all(
      members.map(async (member) => {
        const memberId = member._id.toString()

        const [leadsContacted, followupsDone, proposalsSent, dealsWon] = await Promise.all([
          Activity.countDocuments({ actor: memberId, type: { $in: ['lead_created', 'lead_stage_changed', 'stage_changed'] }, createdAt: { $gte: from, $lte: to } }),
          Activity.countDocuments({ actor: memberId, type: 'followup_done', createdAt: { $gte: from, $lte: to } }),
          Activity.countDocuments({ actor: memberId, type: 'proposal_sent', createdAt: { $gte: from, $lte: to } }),
          Lead.countDocuments({ assignedTo: member._id, stage: 'Won', updatedAt: { $gte: from, $lte: to } }),
        ])

        return {
          _id: memberId,
          name: member.name,
          initials: member.avatarInitials ?? 'NA',
          role: (member.roleId as { name?: string })?.name ?? 'viewer',
          leadsContacted,
          followupsDone,
          proposalsSent,
          dealsWon,
          conversionRate: leadsContacted > 0 ? (dealsWon / leadsContacted) * 100 : 0,
        }
      }),
    )

    const totals = {
      leadsContacted: rows.reduce((sum, row) => sum + row.leadsContacted, 0),
      followupsDone: rows.reduce((sum, row) => sum + row.followupsDone, 0),
      proposalsSent: rows.reduce((sum, row) => sum + row.proposalsSent, 0),
      dealsWon: rows.reduce((sum, row) => sum + row.dealsWon, 0),
    }

    return res.json({
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      members: rows,
      totals,
    })
  } catch (error) {
    console.error('BD performance report error:', error)
    return res.status(500).json({ error: 'Failed to fetch BD performance report' })
  }
})

router.get('/followup-completion', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const { from: fromRaw, to: toRaw } = req.query as { from?: string; to?: string }
    const { from, to } = toDateRange(fromRaw, toRaw)

    const [scheduledRows, completedRows, overdueRows, activeUsers] = await Promise.all([
      FollowUp.find({ dueAt: { $gte: from, $lte: to } }).populate('assignedTo', 'name avatarInitials').select('type assignedTo dueAt isDone doneAt'),
      FollowUp.find({ isDone: true, doneAt: { $gte: from, $lte: to } }).populate('assignedTo', 'name avatarInitials').select('type assignedTo doneAt'),
      FollowUp.find({ isDone: false, dueAt: { $gte: from, $lte: to, $lt: new Date() } }).populate('assignedTo', 'name avatarInitials').select('type assignedTo dueAt'),
      User.find({ status: 'active' }).select('name avatarInitials'),
    ])

    const totalScheduled = scheduledRows.length
    const totalCompleted = completedRows.length
    const totalOverdue = overdueRows.length
    const completionRate = totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0

    const byType = (['Phone call', 'WhatsApp', 'Walk-in'] as const).map((type) => {
      const scheduled = scheduledRows.filter((row) => normalizeFollowupType(row.type) === type).length
      const completed = completedRows.filter((row) => normalizeFollowupType(row.type) === type).length
      return {
        type,
        scheduled,
        completed,
        completionRate: scheduled > 0 ? (completed / scheduled) * 100 : 0,
      }
    })

    const byMember = activeUsers.map((user) => {
      const userId = user._id.toString()
      const scheduled = scheduledRows.filter((row) => ((row.assignedTo as { _id?: { toString: () => string } })?._id?.toString() ?? '') === userId).length
      const completed = completedRows.filter((row) => ((row.assignedTo as { _id?: { toString: () => string } })?._id?.toString() ?? '') === userId).length
      const overdue = overdueRows.filter((row) => ((row.assignedTo as { _id?: { toString: () => string } })?._id?.toString() ?? '') === userId).length
      return {
        _id: userId,
        name: user.name,
        initials: user.avatarInitials ?? 'NA',
        scheduled,
        completed,
        overdue,
        completionRate: scheduled > 0 ? (completed / scheduled) * 100 : 0,
      }
    })

    const weeklyTrend = (() => {
      const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000))
      const bucketCount = Math.min(6, Math.max(1, Math.ceil(days / 7)))
      const bucketSizeMs = Math.ceil((to.getTime() - from.getTime()) / bucketCount)

      return Array.from({ length: bucketCount }).map((_, idx) => {
        const start = new Date(from.getTime() + idx * bucketSizeMs)
        const end = new Date(idx === bucketCount - 1 ? to.getTime() + 1 : from.getTime() + (idx + 1) * bucketSizeMs)
        const completed = completedRows.filter((row) => {
          const doneAt = row.doneAt ?? new Date(0)
          return doneAt >= start && doneAt < end
        }).length
        const overdue = overdueRows.filter((row) => row.dueAt >= start && row.dueAt < end).length

        return {
          week: `Week ${idx + 1}`,
          completed,
          overdue,
        }
      })
    })()

    return res.json({
      summary: { totalScheduled, totalCompleted, totalOverdue, completionRate },
      byMember,
      byType,
      weeklyTrend,
    })
  } catch (error) {
    console.error('Follow-up completion report error:', error)
    return res.status(500).json({ error: 'Failed to fetch follow-up completion report' })
  }
})

router.get('/conversion', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    if (auth.roleName !== 'admin' && auth.roleName !== 'bd_intern') {
      return res.status(403).json({ error: 'Conversion report is available for admin and BD team members.' })
    }

    const months = Math.max(1, Math.min(12, Number(req.query.months) || 6))

    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
    const leadQuery: Record<string, unknown> = { createdAt: { $gte: from } }
    if (auth.roleName === 'bd_intern') {
      leadQuery.assignedTo = auth.userId
    }

    const leads = await Lead.find(leadQuery).sort({ createdAt: 1 })

    const monthRows = Array.from({ length: months }).map((_, idx) => {
      const current = new Date(now.getFullYear(), now.getMonth() - (months - 1 - idx), 1)
      const next = new Date(current.getFullYear(), current.getMonth() + 1, 1)

      const leadsInMonth = leads.filter((lead) => lead.createdAt >= current && lead.createdAt < next)
      const totalLeadsEntered = leadsInMonth.length
      const dealsWon = leadsInMonth.filter((lead) => lead.stage === 'Won').length

      const stageBreakdown = STAGE_ORDER.map((stage, stageIndex) => {
        const entered = leadsInMonth.filter((lead) => lead.stage === stage).length
        const converted = leadsInMonth.filter((lead) => {
          const idx = STAGE_ORDER.indexOf(lead.stage)
          return idx > stageIndex && idx !== STAGE_ORDER.length - 1
        }).length
        const conversionRate = entered > 0 ? Number(((converted / entered) * 100).toFixed(1)) : 0

        return {
          stage,
          entered,
          converted,
          conversionRate,
        }
      })

      const overallConversionRate = totalLeadsEntered > 0 ? Number(((dealsWon / totalLeadsEntered) * 100).toFixed(1)) : 0

      return {
        label: current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        totalLeadsEntered,
        stageBreakdown,
        overallConversionRate,
        dealsWon,
        revenueValue: null,
      }
    })

    const bestMonth =
      monthRows.reduce((best, item) => (item.overallConversionRate > best.overallConversionRate ? item : best), monthRows[0])?.label ??
      now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

    const avgConversionRate =
      monthRows.length > 0
        ? Number((monthRows.reduce((sum, item) => sum + item.overallConversionRate, 0) / monthRows.length).toFixed(1))
        : 0

    return res.json({
      period: 'month',
      months: monthRows,
      bestMonth,
      avgConversionRate,
    })
  } catch (error) {
    console.error('Conversion report error:', error)
    return res.status(500).json({ error: 'Failed to fetch conversion report' })
  }
})

router.get('/conversion/team', async (req: AuthRequest, res: Response) => {
  try {
    const auth = await getAuthContext(req)
    if (!auth) return res.status(401).json({ error: 'Not authenticated' })

    if (auth.roleName !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view team conversion report' })
    }

    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    const users = await User.find({ status: 'active' }).select('name avatarInitials')

    const members = await Promise.all(
      users.map(async (user) => {
        const [leadsWorked, dealsWon] = await Promise.all([
          Lead.countDocuments({ assignedTo: user._id, updatedAt: { $gte: start } }),
          Lead.countDocuments({ assignedTo: user._id, stage: 'Won', updatedAt: { $gte: start } }),
        ])

        const conversionRate = leadsWorked > 0 ? Number(((dealsWon / leadsWorked) * 100).toFixed(1)) : 0

        return {
          name: user.name,
          initials: user.avatarInitials,
          _id: user._id,
          dealsWon,
          leadsWorked,
          conversionRate,
          avgDaysToClose: null,
        }
      })
    )

    return res.json({ members })
  } catch (error) {
    console.error('Team conversion report error:', error)
    return res.status(500).json({ error: 'Failed to fetch team conversion report' })
  }
})

export default router
