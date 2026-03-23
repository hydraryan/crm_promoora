import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import leadsRoutes from './routes/leads.js'
import followupRoutes from './routes/followups.js'
import activityRoutes from './routes/activity.js'
import performanceRoutes from './routes/performance.js'
import reportRoutes from './routes/reports.js'
import teamRoutes from './routes/team.js'
import clientsRoutes from './routes/clients.js'
import projectsRoutes from './routes/projects.js'
import proposalsRoutes from './routes/proposals.js'
import { invoicesRouter } from './routes/invoices.js'
import communicationRoutes from './routes/communication.js'
import rolesRoutes from './routes/roles.js'

const app = express()

app.use(express.json())
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)

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

app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

export default app
