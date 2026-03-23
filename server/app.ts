import express from 'express'
import cors from 'cors'
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
