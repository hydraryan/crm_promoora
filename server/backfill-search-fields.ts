/**
 * One-time backfill for universal search artifacts.
 *
 * Usage:
 *   npm run backfill:search
 *   npm run backfill:search -- --dry-run
 *   npm run backfill:search -- --all
 *   npm run backfill:search -- --batch=1000
 */
import type { Model } from 'mongoose'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { buildSearchArtifacts } from './models/search-utils.js'
import { Lead } from './models/Lead.js'
import { Client } from './models/Client.js'
import { Project } from './models/Project.js'
import { Proposal } from './models/Proposal.js'
import { FollowUp } from './models/FollowUp.js'
import { InvoiceModel } from './models/Invoice.js'
import { User } from './models/User.js'

type LeanDoc = {
  _id: unknown
  [key: string]: unknown
}

type SearchBackfillModel = {
  label: string
  model: Model<unknown>
  projection: Record<string, 1>
  values: (doc: LeanDoc) => Array<string | null | undefined>
}

type CliOptions = {
  dryRun: boolean
  includeAll: boolean
  batchSize: number
}

function toStringSafe(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseCliOptions(argv: string[]): CliOptions {
  let batchSize = 500

  for (const arg of argv) {
    if (!arg.startsWith('--batch=')) continue
    const parsed = Number(arg.split('=')[1])
    if (Number.isFinite(parsed) && parsed > 0) {
      batchSize = Math.floor(parsed)
    }
  }

  return {
    dryRun: argv.includes('--dry-run'),
    includeAll: argv.includes('--all'),
    batchSize,
  }
}

async function backfillModel(config: SearchBackfillModel, options: CliOptions) {
  const filter = options.includeAll
    ? {}
    : {
        $or: [
          { searchText: { $exists: false } },
          { searchText: '' },
          { searchPrefixes: { $exists: false } },
          { searchPrefixes: { $size: 0 } },
        ],
      }

  const total = await config.model.countDocuments(filter)
  if (total === 0) {
    console.log(`- ${config.label}: nothing to backfill`)
    return { scanned: 0, updated: 0 }
  }

  console.log(`- ${config.label}: ${total} documents to process`)

  let scanned = 0
  let updated = 0
  let operations: Array<{
    updateOne: {
      filter: { _id: unknown }
      update: { $set: { searchText: string; searchPrefixes: string[] } }
    }
  }> = []

  const cursor = config.model
    .find(filter, { _id: 1, ...config.projection })
    .lean()
    .cursor<LeanDoc>()

  for await (const doc of cursor) {
    scanned += 1

    const artifacts = buildSearchArtifacts(config.values(doc))
    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            searchText: artifacts.searchText,
            searchPrefixes: artifacts.searchPrefixes,
          },
        },
      },
    })

    if (operations.length >= options.batchSize) {
      if (!options.dryRun) {
        await config.model.bulkWrite(operations, { ordered: false })
      }
      updated += operations.length
      operations = []
    }
  }

  if (operations.length > 0) {
    if (!options.dryRun) {
      await config.model.bulkWrite(operations, { ordered: false })
    }
    updated += operations.length
  }

  console.log(`  ${options.dryRun ? 'would update' : 'updated'} ${updated} / ${scanned}`)
  return { scanned, updated }
}

const BACKFILL_MODELS: SearchBackfillModel[] = [
  {
    label: 'Lead',
    model: Lead,
    projection: { businessName: 1, ownerName: 1, phone: 1, email: 1, notes: 1 },
    values: (doc) => [
      toStringSafe(doc.businessName),
      toStringSafe(doc.ownerName),
      toStringSafe(doc.phone),
      toStringSafe(doc.email),
      toStringSafe(doc.notes),
    ],
  },
  {
    label: 'Client',
    model: Client,
    projection: {
      businessName: 1,
      ownerName: 1,
      phone: 1,
      email: 1,
      website: 1,
      address: 1,
      notes: 1,
      services: 1,
    },
    values: (doc) => {
      const services = Array.isArray(doc.services) ? doc.services.join(' ') : undefined
      return [
        toStringSafe(doc.businessName),
        toStringSafe(doc.ownerName),
        toStringSafe(doc.phone),
        toStringSafe(doc.email),
        toStringSafe(doc.website),
        toStringSafe(doc.address),
        toStringSafe(doc.notes),
        services,
      ]
    },
  },
  {
    label: 'Project',
    model: Project,
    projection: { title: 1, description: 1, serviceType: 1, status: 1, notes: 1, tasks: 1 },
    values: (doc) => {
      const taskTitles = Array.isArray(doc.tasks)
        ? doc.tasks
            .map((task) => {
              if (!task || typeof task !== 'object') return ''
              const title = (task as { title?: unknown }).title
              return typeof title === 'string' ? title : ''
            })
            .join(' ')
        : undefined

      return [
        toStringSafe(doc.title),
        toStringSafe(doc.description),
        toStringSafe(doc.serviceType),
        toStringSafe(doc.status),
        toStringSafe(doc.notes),
        taskTitles,
      ]
    },
  },
  {
    label: 'Proposal',
    model: Proposal,
    projection: { proposalNumber: 1, title: 1, notes: 1, rejectionReason: 1, status: 1, serviceBlocks: 1 },
    values: (doc) => {
      const blockText = Array.isArray(doc.serviceBlocks)
        ? doc.serviceBlocks
            .map((block) => {
              if (!block || typeof block !== 'object') return ''
              const b = block as { title?: unknown; description?: unknown }
              const title = typeof b.title === 'string' ? b.title : ''
              const description = typeof b.description === 'string' ? b.description : ''
              return `${title} ${description}`.trim()
            })
            .join(' ')
        : undefined

      return [
        toStringSafe(doc.proposalNumber),
        toStringSafe(doc.title),
        toStringSafe(doc.notes),
        toStringSafe(doc.rejectionReason),
        toStringSafe(doc.status),
        blockText,
      ]
    },
  },
  {
    label: 'FollowUp',
    model: FollowUp,
    projection: { businessName: 1, ownerName: 1, note: 1, type: 1 },
    values: (doc) => [
      toStringSafe(doc.businessName),
      toStringSafe(doc.ownerName),
      toStringSafe(doc.note),
      toStringSafe(doc.type),
    ],
  },
  {
    label: 'Invoice',
    model: InvoiceModel,
    projection: { invoiceNumber: 1, status: 1, notes: 1, lineItems: 1 },
    values: (doc) => {
      const lineText = Array.isArray(doc.lineItems)
        ? doc.lineItems
            .map((item) => {
              if (!item || typeof item !== 'object') return ''
              const line = item as { description?: unknown; subDescription?: unknown }
              const description = typeof line.description === 'string' ? line.description : ''
              const subDescription = typeof line.subDescription === 'string' ? line.subDescription : ''
              return `${description} ${subDescription}`.trim()
            })
            .join(' ')
        : undefined

      return [toStringSafe(doc.invoiceNumber), toStringSafe(doc.status), toStringSafe(doc.notes), lineText]
    },
  },
  {
    label: 'User',
    model: User,
    projection: { name: 1, email: 1, phone: 1 },
    values: (doc) => [toStringSafe(doc.name), toStringSafe(doc.email), toStringSafe(doc.phone)],
  },
]

async function main() {
  const options = parseCliOptions(process.argv.slice(2))

  console.log('Search backfill starting...')
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'write'}`)
  console.log(`Scope: ${options.includeAll ? 'all documents' : 'only missing/empty artifacts'}`)
  console.log(`Batch size: ${options.batchSize}`)

  await connectDatabase()

  let totalScanned = 0
  let totalUpdated = 0

  for (const config of BACKFILL_MODELS) {
    const result = await backfillModel(config, options)
    totalScanned += result.scanned
    totalUpdated += result.updated
  }

  console.log('Search backfill complete.')
  console.log(`Scanned: ${totalScanned}`)
  console.log(`${options.dryRun ? 'Would update' : 'Updated'}: ${totalUpdated}`)
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => {
      // Ignore disconnect errors while exiting.
    })
  })