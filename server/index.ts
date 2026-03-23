import dotenv from 'dotenv'
import { connectDatabase } from './config/db.js'
import app from './app.js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const PORT = process.env.PORT || 4000

// Start server
async function startServer() {
  try {
    await connectDatabase()

    app.listen(PORT, () => {
      console.log('')
      console.log('🚀 CRM Portal API Server')
      console.log('=' .repeat(50))
      console.log(`📍 Server running on http://localhost:${PORT}`)
      console.log(`🔗 API endpoints:`)
      console.log(`   POST   /api/auth/login`)
      console.log(`   POST   /api/auth/refresh`)
      console.log(`   POST   /api/auth/logout`)
      console.log(`   GET    /api/leads`)
      console.log(`   GET    /api/leads/pipeline-summary`)
      console.log(`   GET    /api/followups/today`)
      console.log(`   PATCH  /api/followups/:id/done`)
      console.log(`   GET    /api/activity/today`)
      console.log(`   GET    /api/performance/me`)
      console.log(`   GET    /api/performance/user/:id`)
      console.log(`   GET    /api/reports/conversion`)
      console.log(`   GET    /api/reports/conversion/team`)
      console.log(`   GET    /api/team/members`)
      console.log(`   GET    /api/projects`)
      console.log(`   POST   /api/projects`)
      console.log(`   GET    /api/projects/:id`)
      console.log(`   GET    /api/health`)
      console.log('')
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app
