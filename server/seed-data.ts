/**
 * Database seeding script
 * Run with: npx tsx server/seed-data.ts
 */
import mongoose from 'mongoose'
import { seedRoles, seedAdminUser, hashPassword } from './models/seed.js'
import dotenv from 'dotenv'
import { Role } from './models/Role.js'
import { User } from './models/User.js'
import { Lead, type BusinessType, type LeadStage } from './models/Lead.js'
import { FollowUp, type FollowUpType } from './models/FollowUp.js'
import { Activity, type ActivityType } from './models/Activity.js'
import { Client, type ClientBusinessType, type ClientStatus } from './models/Client.js'
import { Project, type ProjectStatus, type ServiceType } from './models/Project.js'
import { Proposal } from './models/Proposal.js'
import { InvoiceModel } from './models/Invoice.js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local')
  process.exit(1)
}

const mongoUri: string = MONGODB_URI

async function ensureDemoUsers() {
  const staff = [
    { name: 'Priya Anand', email: 'priya@promoora.in', role: 'bd_intern' as const },
    { name: 'Rahul Nair', email: 'rahul@promoora.in', role: 'bd_intern' as const },
    { name: 'Arjun Verma', email: 'arjun@promoora.in', role: 'bd_intern' as const },
    { name: 'Dev Mehta', email: 'dev@promoora.in', role: 'tech_intern' as const },
  ]

  const roles = await Role.find({ name: { $in: ['bd_intern', 'tech_intern'] } })
  const roleMap = new Map(roles.map((role) => [role.name, role._id]))

  for (const member of staff) {
    const existing = await User.findOne({ email: member.email })
    if (existing) continue

    const roleId = roleMap.get(member.role)
    if (!roleId) continue

    const passwordHash = await hashPassword('Promoora@123')
    await User.create({
      name: member.name,
      email: member.email,
      passwordHash,
      roleId,
      status: 'active',
      isEmailVerified: true,
    })
  }
}

async function seedOperationalData() {
  const existingLeads = await Lead.countDocuments()
  if (existingLeads > 0) {
    console.log('✓ Operational CRM data already seeded. Skipping...')
    return
  }

  const users = await User.find({ status: 'active' })
  const admin = users.find((user) => user.email === 'ceo@promoora.in')
  const bdMembers = users.filter((user) => ['Priya Anand', 'Rahul Nair', 'Arjun Verma'].includes(user.name))

  if (!admin || bdMembers.length === 0) {
    console.log('⚠ Could not seed operational data (missing seeded users).')
    return
  }

  const stageTemplate: LeadStage[] = ['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation', 'Won', 'Lost']
  const businessTypes: BusinessType[] = ['restaurant', 'clinic', 'salon', 'shop', 'other']
  const businesses = [
    ['Hotel Spice Garden', 'Rajiv Sharma'],
    ['City Bakery', 'Anand Kumar'],
    ['Tanvi Beauty Salon', 'Tanvi Kapoor'],
    ['Sunrise Pharmacy', 'Deepak Jain'],
    ['Gupta Hardware', 'Ramesh Gupta'],
    ['The Dhaba Corner', 'Amit Rana'],
    ['Dr. Mehta Clinic', 'Rohit Mehta'],
    ['Metro Mobile Shop', 'Siddharth Rao'],
    ['Kapoor Sweets', 'Nitin Kapoor'],
    ['Nova Dental Care', 'Ishita Jain'],
    ['Urban Fitness Hub', 'Nilesh Patil'],
    ['Fresh Mart', 'Ravi Sinha'],
  ]

  const leads = await Promise.all(
    businesses.map(async ([businessName, ownerName], idx) => {
      const assigned = bdMembers[idx % bdMembers.length]
      const stage = stageTemplate[idx % stageTemplate.length]
      const createdAt = new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000)
      const lastActivityAt = new Date(createdAt.getTime() + 8 * 60 * 60 * 1000)

      return Lead.create({
        businessName,
        ownerName,
        phone: `+91-98${String(10000000 + idx).slice(-8)}`,
        businessType: businessTypes[idx % businessTypes.length],
        stage,
        assignedTo: assigned._id,
        createdBy: admin._id,
        createdAt,
        updatedAt: createdAt,
        lastActivityAt,
      })
    })
  )

  const followUpTypes: FollowUpType[] = ['call', 'whatsapp', 'walk-in']
  await Promise.all(
    leads.slice(0, 10).map((lead, idx) => {
      const assigned = bdMembers[idx % bdMembers.length]
      const dueAt = new Date()
      dueAt.setHours(11 + (idx % 5), 0, 0, 0)
      if (idx < 3) dueAt.setDate(dueAt.getDate() - 1)

      return FollowUp.create({
        leadId: lead._id,
        businessName: lead.businessName,
        ownerName: lead.ownerName,
        type: followUpTypes[idx % followUpTypes.length],
        assignedTo: assigned._id,
        dueAt,
        isDone: false,
        createdBy: admin._id,
      })
    })
  )

  const activityTypes: ActivityType[] = ['lead_created', 'note', 'proposal_sent', 'stage_changed', 'followup_done']
  await Promise.all(
    leads.slice(0, 16).map((lead, idx) => {
      const actor = bdMembers[idx % bdMembers.length]
      const createdAt = new Date(Date.now() - idx * 3 * 60 * 60 * 1000)
      const type = activityTypes[idx % activityTypes.length]

      return Activity.create({
        actor: actor._id,
        type,
        description:
          type === 'lead_created'
            ? `created a new lead - ${lead.businessName}`
            : type === 'proposal_sent'
              ? `sent a proposal to ${lead.businessName}`
              : type === 'followup_done'
                ? `completed follow-up - ${lead.businessName}`
                : type === 'stage_changed'
                  ? `moved ${lead.businessName} to ${lead.stage}`
                  : `added a note on ${lead.businessName}`,
        targetName: lead.businessName,
        targetId: lead._id.toString(),
        createdAt,
        updatedAt: createdAt,
      })
    })
  )

  console.log('✓ Seeded operational CRM data (leads, follow-ups, activities)')
}

async function seedClientsData() {
  const existingClients = await Client.countDocuments()
  if (existingClients > 0) {
    console.log('✓ Clients data already seeded. Skipping...')
    return
  }

  const users = await User.find({ status: 'active' })
  const admin = users.find((user) => user.email === 'ceo@promoora.in')
  const bdMembers = users.filter((user) => ['Priya Anand', 'Rahul Nair', 'Arjun Verma'].includes(user.name))

  if (!admin || bdMembers.length === 0) {
    console.log('⚠ Could not seed clients data (missing seeded users).')
    return
  }

  const template: Array<{
    businessName: string
    ownerName: string
    businessType: ClientBusinessType
    status: ClientStatus
    services: string[]
    contractValue?: number
  }> = [
    {
      businessName: 'Urban Tandoor House',
      ownerName: 'Vikram Malhotra',
      businessType: 'Restaurant',
      status: 'Active',
      services: ['Website', 'CRM'],
      contractValue: 78000,
    },
    {
      businessName: 'CareFirst Polyclinic',
      ownerName: 'Dr. Riddhi Shah',
      businessType: 'Clinic',
      status: 'Onboarding',
      services: ['CRM', 'UI/UX'],
      contractValue: 62000,
    },
    {
      businessName: 'Glowline Studio',
      ownerName: 'Sneha Kapoor',
      businessType: 'Salon',
      status: 'Onboarding',
      services: ['Website', 'HRM'],
      contractValue: 45000,
    },
    {
      businessName: 'Metro Bazaar Retail',
      ownerName: 'Tarun Sethi',
      businessType: 'Shop & retail',
      status: 'Active',
      services: ['Website', 'CRM', 'HRM'],
      contractValue: 98000,
    },
    {
      businessName: 'Wellnest Diagnostics',
      ownerName: 'Dr. Armaan Gill',
      businessType: 'Clinic',
      status: 'Inactive',
      services: ['CRM'],
      contractValue: 39000,
    },
    {
      businessName: 'Mitti Meals',
      ownerName: 'Kunal Tyagi',
      businessType: 'Restaurant',
      status: 'Active',
      services: ['Website', 'UI/UX'],
      contractValue: 71000,
    },
    {
      businessName: 'Silk Route Salon',
      ownerName: 'Nisha Bhandari',
      businessType: 'Salon',
      status: 'Onboarding',
      services: ['Website', 'CRM'],
      contractValue: 56000,
    },
    {
      businessName: 'PrimeKart Stores',
      ownerName: 'Aditya Khurana',
      businessType: 'Shop & retail',
      status: 'Inactive',
      services: ['Website'],
      contractValue: 28000,
    },
  ]

  const createdClients = await Promise.all(
    template.map(async (item, idx) => {
      const assigned = bdMembers[idx % bdMembers.length]
      const createdAt = new Date(Date.now() - (idx + 3) * 48 * 60 * 60 * 1000)

      return Client.create({
        businessName: item.businessName,
        ownerName: item.ownerName,
        phone: `+91-97${String(11000000 + idx).slice(-8)}`,
        email: `${item.ownerName.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
        businessType: item.businessType,
        status: item.status,
        assignedTo: assigned._id,
        website: `https://${item.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.in`,
        address: `Sector ${12 + idx}, Gurugram`,
        services: item.services,
        onboardingStartedAt: item.status === 'Onboarding' ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : undefined,
        activeFrom: item.status === 'Active' ? new Date(createdAt.getTime() + 36 * 60 * 60 * 1000) : undefined,
        contractValue: item.contractValue,
        notes:
          item.status === 'Inactive'
            ? 'Paused due to budget cycle; revisit in next quarter.'
            : item.status === 'Onboarding'
              ? 'Kickoff done. Asset collection in progress.'
              : 'Monthly performance review is positive.',
        createdBy: admin._id,
        createdAt,
        updatedAt: createdAt,
      })
    })
  )

  await Promise.all(
    createdClients.map((client, idx) => {
      const actor = bdMembers[idx % bdMembers.length]
      const createdAt = new Date(Date.now() - idx * 2 * 60 * 60 * 1000)

      return Activity.create({
        actor: actor._id,
        type: 'client_added',
        description: `onboarded client ${client.businessName}`,
        targetName: client.businessName,
        targetId: client._id.toString(),
        createdAt,
        updatedAt: createdAt,
      })
    })
  )

  console.log('✓ Seeded clients data')
}

async function seedProjectsData() {
  const existingProjects = await Project.countDocuments()
  if (existingProjects > 0) {
    console.log('✓ Projects data already seeded. Skipping...')
    return
  }

  const users = await User.find({ status: 'active' })
  const admin = users.find((user) => user.email === 'ceo@promoora.in')
  const members = users.filter((user) => ['Priya Anand', 'Rahul Nair', 'Arjun Verma', 'Dev Mehta'].includes(user.name))
  const clients = await Client.find().sort({ createdAt: 1 }).limit(8)

  if (!admin || members.length === 0 || clients.length === 0) {
    console.log('⚠ Could not seed projects data (missing users or clients).')
    return
  }

  const serviceCycle: ServiceType[] = ['Website build', 'Automation tools', 'UI/UX design']
  const statusCycle: ProjectStatus[] = ['In progress', 'Under review', 'Completed', 'On hold']

  const createdProjects = await Promise.all(
    clients.map(async (client, idx) => {
      const serviceType = serviceCycle[idx % serviceCycle.length]
      const status = statusCycle[idx % statusCycle.length]
      const assigned = [members[idx % members.length], members[(idx + 1) % members.length]]
      const startDate = new Date(Date.now() - (idx + 1) * 7 * 24 * 60 * 60 * 1000)
      const dueDate = new Date(startDate.getTime() + (10 + idx) * 24 * 60 * 60 * 1000)

      return Project.create({
        title: `${client.businessName} ${serviceType === 'Website build' ? 'Web Revamp' : serviceType === 'Automation tools' ? 'Ops Automation' : 'Design Sprint'}`,
        description:
          serviceType === 'Website build'
            ? 'Design and deliver responsive website with lead capture and analytics.'
            : serviceType === 'Automation tools'
              ? 'Automate repetitive workflows and reporting operations for the client team.'
              : 'Refresh UX flows and core visual system for customer-facing surfaces.',
        client: client._id,
        serviceType,
        status,
        assignedTo: assigned.map((member) => member._id),
        startDate,
        dueDate,
        completedAt: status === 'Completed' ? new Date(startDate.getTime() + 8 * 24 * 60 * 60 * 1000) : undefined,
        priority: idx % 3 === 0 ? 'high' : idx % 3 === 1 ? 'medium' : 'low',
        progress: status === 'Completed' ? 100 : status === 'Under review' ? 85 : status === 'On hold' ? 40 : 55,
        tasks: [
          {
            title: 'Kickoff and requirement alignment',
            isDone: true,
            assignedTo: assigned[0]._id,
            dueDate: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000),
            createdAt: startDate,
          },
          {
            title: 'Core implementation milestone',
            isDone: status === 'Completed' || status === 'Under review',
            assignedTo: assigned[1]._id,
            dueDate: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000),
            createdAt: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
          },
          {
            title: 'Final QA and handoff',
            isDone: status === 'Completed',
            assignedTo: assigned[0]._id,
            dueDate,
            createdAt: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000),
          },
        ],
        notes: status === 'On hold' ? 'Paused pending client-side approvals and document sign-off.' : 'Weekly check-in rhythm established.',
        createdBy: admin._id,
      })
    })
  )

  await Promise.all(
    createdProjects.map((project, idx) => {
      const actor = members[idx % members.length]
      const createdAt = new Date(Date.now() - idx * 90 * 60 * 1000)
      return Activity.create({
        actor: actor._id,
        type: 'note',
        description: `updated project ${project.title}`,
        targetName: project.title,
        targetId: project._id.toString(),
        createdAt,
        updatedAt: createdAt,
      })
    })
  )

  console.log('✓ Seeded projects data')
}

async function seedProposalsData() {
  const existingProposals = await Proposal.countDocuments()
  if (existingProposals > 0) {
    console.log('✓ Proposals data already seeded. Skipping...')
    return
  }

  const users = await User.find({ status: 'active' })
  const proposalOwners = users.filter((user) => ['Priya Anand', 'Rahul Nair', 'Arjun Verma'].includes(user.name))
  const leads = await Lead.find().sort({ createdAt: 1 }).limit(5)
  const clients = await Client.find().sort({ createdAt: 1 }).limit(5)

  if (proposalOwners.length === 0 || (leads.length === 0 && clients.length === 0)) {
    console.log('⚠ Could not seed proposals data (missing users/leads/clients).')
    return
  }

  const targetRows = [
    ...leads.map((lead) => ({ targetType: 'lead' as const, id: lead._id, businessName: lead.businessName })),
    ...clients.map((client) => ({ targetType: 'client' as const, id: client._id, businessName: client.businessName })),
  ].slice(0, 8)

  const statusCycle = ['Draft', 'Sent', 'Awaiting response', 'Accepted', 'Rejected'] as const

  await Promise.all(
    targetRows.map((target, idx) => {
      const owner = proposalOwners[idx % proposalOwners.length]
      const status = statusCycle[idx % statusCycle.length]
      const proposalNumber = `PRO-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`
      const createdAt = new Date(Date.now() - (idx + 1) * 36 * 60 * 60 * 1000)

      return Proposal.create({
        proposalNumber,
        title: `Digital Package for ${target.businessName}`,
        targetType: target.targetType,
        leadId: target.targetType === 'lead' ? target.id : undefined,
        clientId: target.targetType === 'client' ? target.id : undefined,
        status,
        serviceBlocks: [
          {
            id: new mongoose.Types.ObjectId().toString(),
            serviceKey: 'website_build',
            title: 'Website Build',
            description: 'Modern, responsive website designed to improve lead capture and trust.',
            deliverables: ['Homepage + 4 inner pages', 'Contact form + WhatsApp', 'Basic SEO setup'],
          },
          {
            id: new mongoose.Types.ObjectId().toString(),
            serviceKey: 'crm_setup',
            title: 'CRM Setup',
            description: 'Simple lead tracking workflow with follow-up reminders.',
            deliverables: ['Lead pipeline setup', 'Follow-up dashboard', 'Team onboarding session'],
          },
        ],
        milestones: [
          { id: new mongoose.Types.ObjectId().toString(), title: 'Discovery', duration: '3-5 days' },
          { id: new mongoose.Types.ObjectId().toString(), title: 'Build', duration: '7-10 days' },
          { id: new mongoose.Types.ObjectId().toString(), title: 'Launch', duration: '1-2 days' },
        ],
        notes: 'Seeded proposal for dashboard testing.',
        createdBy: owner._id,
        sentAt: status === 'Sent' || status === 'Awaiting response' || status === 'Accepted' || status === 'Rejected' ? new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) : undefined,
        acceptedAt: status === 'Accepted' ? new Date(createdAt.getTime() + 14 * 60 * 60 * 1000) : undefined,
        rejectedAt: status === 'Rejected' ? new Date(createdAt.getTime() + 14 * 60 * 60 * 1000) : undefined,
        rejectionReason: status === 'Rejected' ? 'Budget deferred to next quarter.' : undefined,
        createdAt,
        updatedAt: createdAt,
      })
    })
  )

  console.log('✓ Seeded proposals data')
}

async function seedInvoicesData() {
  const existingInvoices = await InvoiceModel.countDocuments()
  if (existingInvoices > 0) {
    console.log('✓ Invoices data already seeded. Skipping...')
    return
  }

  const users = await User.find({ status: 'active' })
  const admin = users.find((user) => user.email === 'ceo@promoora.in')
  const invoiceOwners = users.filter((user) => ['Priya Anand', 'Rahul Nair', 'Arjun Verma'].includes(user.name))
  const clients = await Client.find().sort({ createdAt: 1 }).limit(8)

  if (!admin || invoiceOwners.length === 0 || clients.length === 0) {
    console.log('⚠ Could not seed invoices data (missing users/clients).')
    return
  }

  const statusCycle: Array<'Unpaid' | 'Paid' | 'Overdue'> = ['Unpaid', 'Paid', 'Overdue']

  await Promise.all(
    clients.map((client, idx) => {
      const owner = invoiceOwners[idx % invoiceOwners.length]
      const status = statusCycle[idx % statusCycle.length]
      const createdAt = new Date(Date.now() - (idx + 2) * 32 * 60 * 60 * 1000)
      const invoiceDate = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000)
      const dueDate = new Date(invoiceDate.getTime() + (7 + idx) * 24 * 60 * 60 * 1000)

      const lineItems = [
        {
          id: new mongoose.Types.ObjectId().toString(),
          description: 'Website maintenance and support',
          subDescription: 'Monthly plan with uptime monitoring',
          qty: 1,
          rate: 18000 + idx * 1000,
          amount: 18000 + idx * 1000,
        },
        {
          id: new mongoose.Types.ObjectId().toString(),
          description: 'CRM optimization',
          subDescription: 'Workflow and dashboard tuning',
          qty: 1,
          rate: 12000 + idx * 500,
          amount: 12000 + idx * 500,
        },
      ]

      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
      const gstEnabled = idx % 2 === 0
      const gstAmount = gstEnabled ? Number((subtotal * 0.18).toFixed(2)) : 0
      const totalAmount = Number((subtotal + gstAmount).toFixed(2))

      return InvoiceModel.create({
        invoiceNumber: `INV-${String(idx + 1).padStart(4, '0')}`,
        clientId: client._id,
        lineItems,
        invoiceDate,
        dueDate,
        subtotal,
        gstEnabled,
        gstAmount,
        totalAmount,
        status,
        notes: status === 'Overdue' ? 'Payment reminder sent and awaiting confirmation.' : 'Seeded invoice for billing demo.',
        createdBy: owner._id,
        createdAt,
        updatedAt: createdAt,
      })
    })
  )

  console.log('✓ Seeded invoices data')
}

async function seedFollowupsData() {
  const [existingLeadFollowups, existingClientFollowups] = await Promise.all([
    FollowUp.countDocuments({ targetType: 'lead' }),
    FollowUp.countDocuments({ targetType: 'client' }),
  ])

  if (existingLeadFollowups > 0 && existingClientFollowups > 0) {
    console.log('✓ Follow-ups data already seeded for leads and clients. Skipping...')
    return
  }

  const users = await User.find({ status: 'active' })
  const admin = users.find((user) => user.email === 'ceo@promoora.in')
  const bdMembers = users.filter((user) => ['Priya Anand', 'Rahul Nair', 'Arjun Verma'].includes(user.name))

  if (!admin || bdMembers.length === 0) {
    console.log('⚠ Could not seed follow-ups data (missing seeded users).')
    return
  }

  const followupTypes: Array<'Phone call' | 'Walk-in' | 'WhatsApp'> = ['Phone call', 'Walk-in', 'WhatsApp']
  let createdLeadFollowups = 0
  let createdClientFollowups = 0

  if (existingLeadFollowups === 0) {
    const leads = await Lead.find().sort({ createdAt: 1 }).limit(10)

    if (leads.length === 0) {
      console.log('⚠ No leads found for follow-up seeding.')
    } else {
      await Promise.all(
        leads.map((lead, idx) => {
          const dueAt = new Date()
          dueAt.setHours(10 + (idx % 6), idx % 2 === 0 ? 0 : 30, 0, 0)

          if (idx < 3) dueAt.setDate(dueAt.getDate() - 1)
          else if (idx > 6) dueAt.setDate(dueAt.getDate() + 1)

          const isDone = idx % 5 === 0
          const assignedTo = lead.assignedTo ?? bdMembers[idx % bdMembers.length]._id

          return FollowUp.create({
            leadId: lead._id,
            targetType: 'lead',
            businessName: lead.businessName,
            ownerName: lead.ownerName,
            type: followupTypes[idx % followupTypes.length],
            note: idx % 2 === 0 ? 'Shared latest offer and waiting for confirmation.' : 'Follow up on pending questions before proposal.',
            assignedTo,
            dueAt,
            isDone,
            doneAt: isDone ? new Date(dueAt.getTime() - 30 * 60 * 1000) : undefined,
            createdBy: admin._id,
          })
        })
      )

      createdLeadFollowups = leads.length
    }
  }

  if (existingClientFollowups === 0) {
    const clients = await Client.find().sort({ createdAt: 1 }).limit(10)

    if (clients.length === 0) {
      console.log('⚠ No clients found for follow-up seeding.')
    } else {
      await Promise.all(
        clients.map((client, idx) => {
          const dueAt = new Date()
          dueAt.setHours(11 + (idx % 5), idx % 2 === 0 ? 15 : 45, 0, 0)

          if (idx < 2) dueAt.setDate(dueAt.getDate() - 2)
          else if (idx > 5) dueAt.setDate(dueAt.getDate() + 2)

          const isDone = idx % 4 === 0
          const assignedTo = client.assignedTo ?? bdMembers[idx % bdMembers.length]._id

          return FollowUp.create({
            clientId: client._id,
            targetType: 'client',
            businessName: client.businessName,
            ownerName: client.ownerName,
            type: followupTypes[(idx + 1) % followupTypes.length],
            note: idx % 2 === 0 ? 'Check onboarding milestone completion and blocker list.' : 'Review monthly output and align on next sprint priorities.',
            assignedTo,
            dueAt,
            isDone,
            doneAt: isDone ? new Date(dueAt.getTime() - 20 * 60 * 1000) : undefined,
            createdBy: admin._id,
          })
        })
      )

      createdClientFollowups = clients.length
    }
  }

  console.log(`✓ Seeded follow-ups data (lead: ${createdLeadFollowups}, client: ${createdClientFollowups})`)
}

async function seed() {
  try {
    console.log('🌱 Starting database seeding...')
    console.log(`📡 Connecting to MongoDB: ${mongoUri.replace(/:[^:]*@/, ':****@')}`)

    // Connect to MongoDB
    await mongoose.connect(mongoUri)
    console.log('✓ Connected to MongoDB')

    // Seed roles
    console.log('\n📋 Seeding roles...')
    const roles = await seedRoles()
    console.log(`✓ Seeded ${roles.length} roles`)

    // Seed admin user
    console.log('\n👤 Seeding admin user...')
    const adminUser = await seedAdminUser('Aryan Rajput', 'ceo@promoora.in', 'Aryan@9719')
    if (adminUser) {
      console.log(`✓ Admin user created:`)
      console.log(`  Email: ${adminUser.email}`)
      console.log(`  Name: ${adminUser.name}`)
      console.log(`  Status: ${adminUser.status}`)
    }

    // Seed team demo users
    console.log('\n👥 Seeding team users...')
    await ensureDemoUsers()
    console.log('✓ Team users ready')

    // Seed operational CRM data
    console.log('\n📊 Seeding CRM operational data...')
    await seedOperationalData()

    // Seed clients data
    console.log('\n🏢 Seeding clients data...')
    await seedClientsData()

    // Seed follow-ups data for lead and client targets
    console.log('\n📅 Seeding follow-ups data...')
    await seedFollowupsData()

    // Seed proposals data
    console.log('\n📝 Seeding proposals data...')
    await seedProposalsData()

    // Seed invoices data
    console.log('\n💳 Seeding invoices data...')
    await seedInvoicesData()

    // Seed projects data
    console.log('\n📁 Seeding projects data...')
    await seedProjectsData()

    console.log('\n✨ Seeding completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

seed()
