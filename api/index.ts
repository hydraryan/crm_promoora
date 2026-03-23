import app from '../server/app.js'
import { connectDatabase } from '../server/config/db.js'

let dbReady: Promise<unknown> | null = null

async function ensureDb() {
  if (!dbReady) {
    dbReady = connectDatabase()
  }
  await dbReady
}

export default async function handler(req: any, res: any) {
  await ensureDb()
  return app(req, res)
}
