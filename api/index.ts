import app from '../server/app'
import { connectDatabase } from '../server/config/db'

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
