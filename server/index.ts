import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDatabase } from './config/db'
import authRoutes from './routes/auth'
import leadsRoutes from './routes/leads.ts'
import followupRoutes from './routes/followups'
import activityRoutes from './routes/activity'
import performanceRoutes from './routes/performance'
import reportRoutes from './routes/reports'
import teamRoutes from './routes/team.ts'
import clientsRoutes from './routes/clients'
import projectsRoutes from './routes/projects'
import proposalsRoutes from './routes/proposals'
import { invoicesRouter } from './routes/invoices.ts'
import communicationRoutes from './routes/communication'
import rolesRoutes from './routes/roles'

// Load environment variables
dotenv.config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(express.json())
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/leads', leadsRoutes)
app.use('/api/followups', followupRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/performance', performanceRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/team', teamRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/proposals', proposalsRoutes)
app.use('/api/invoices', invoicesRouter)
app.use('/api/communication', communicationRoutes)
app.use('/api/roles', rolesRoutes)

// Health check
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

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
