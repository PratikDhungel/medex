import express, { type NextFunction, type Request, type Response } from 'express'
import { loadServiceExplorerData } from './data.js'
import { mockNetwork } from './mock.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Load once at startup; a malformed file should stop the server, not each request
const data = loadServiceExplorerData()

app.use(express.json())

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Paths mirror the MedEx API the data was shaped after
app.get('/api/category/active', mockNetwork('categories'), (_req: Request, res: Response) => {
  res.json(data.categories)
})

app.get('/api/providers', mockNetwork('providers'), (_req: Request, res: Response) => {
  res.json(data.providers)
})

app.get('/api/service', mockNetwork('services'), (_req: Request, res: Response) => {
  res.json(data.services)
})

// Unknown API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// Central error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(
    `Server listening on http://localhost:${PORT} ` +
      `(${data.services.length} services, ${data.providers.length} providers, ${data.categories.length} categories)`,
  )
})
