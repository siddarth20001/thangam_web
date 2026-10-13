import pg from 'pg'
import fs from 'node:fs'
export function createPool() {
  if (!process.env.DATABASE_URL) return null
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true, ca: fs.readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8') }, max: 5, connectionTimeoutMillis: 10000, statement_timeout: 15000 })
}
