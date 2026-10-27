import express, { type NextFunction, type Request, type Response } from 'express'
import { BookingService } from './booking/bookings.js'
import { loadBookingData } from './booking/data.js'
import { createBookingRouter } from './booking/routes.js'
import { CartStore } from './cart/cartStore.js'
import { ApiError } from './cart/errors.js'
import { OrderService } from './cart/orders.js'
import { loadCartData } from './cartData.js'
import { createCartRouter } from './cartRoutes.js'
import { loadServiceExplorerData } from './data.js'
import { mockNetwork } from './mock.js'
import { MockRules } from './mockRules.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Load once at startup; a malformed file should stop the server, not each request
const data = loadServiceExplorerData()
const cartData = loadCartData()
// dayOffset values become real dates here, on each provider's calendar
const bookingData = loadBookingData()
for (const issue of bookingData.issues) console.warn(`task3-booking.json: ${issue}`)

// Cart and orders live in memory, so a restart starts from the data file again
const cart = new CartStore(cartData.serverLines)
const rules = new MockRules()
const orders = new OrderService(cart, () => rules.settlement)
const bookings = new BookingService(bookingData)

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

const catalog = new Map(cartData.catalog.map((product) => [product.id, product]))
app.use('/api', createCartRouter({ cart, orders, rules, catalog, guestCart: cartData.guestCart }))
app.use('/api/booking', createBookingRouter(bookings, rules))

/** Dev panel: restores the seed cart and bookings, and forgets all orders. Rules are kept. */
app.post('/api/__mock/reset', (_req: Request, res: Response) => {
  cart.reset()
  orders.reset()
  bookings.reset()
  res.status(204).end()
})

// Unknown API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// Central error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(err)
    return
  }
  // express.json() rejects bodies that aren't valid JSON
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({ code: 'invalid_json', message: 'The request body is not valid JSON' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(
    `Server listening on http://localhost:${PORT} ` +
      `(${data.services.length} services, ${data.providers.length} providers, ${data.categories.length} categories, ` +
      `${cartData.serverLines.length} cart lines, ${bookingData.providers.size} booking providers)`,
  )
})
