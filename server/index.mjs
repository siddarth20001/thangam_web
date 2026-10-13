import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { createPool } from './database.mjs'
import { startNotifications } from './notifications.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOrder, CheckoutError } from './checkout.mjs'
const app = express()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pool = createPool()
const notifications = startNotifications(pool)
app.disable('x-powered-by')
app.use(express.json({ limit: '64kb' }))
app.post('/api/orders', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many checkout attempts. Please try again later.' } }), async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Checkout is temporarily unavailable. Please contact Thangam Traders.' })
  try { res.status(201).json(await createOrder(pool, req.body)) }
  catch (error) {
    if (error instanceof CheckoutError) return res.status(error.status).json({ error: error.message })
    console.error('Order creation failed:', error.code ?? error.name)
    res.status(503).json({ error: 'Your order could not be submitted. Please retry using the same checkout.' })
  }
})
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))
app.use(express.static(path.join(root, 'dist')))
app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')))
app.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Request too large.' : 'Invalid request.' }))
const server = app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => console.log('Thangam server listening on port '+(process.env.PORT ?? 3001)))
async function stop() { server.close(); await notifications.stop(); if (pool) await pool.end() }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
