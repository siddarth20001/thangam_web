import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createOrder, validateOrder } from '../../supabase/functions/_shared/checkout.js'
import { createPool } from '../database.mjs'
const makeOrder = (productId, quantity = 2) => ({ request_id: randomUUID(), customer: { name: 'Checkout verification', phone: '9000000000', address: 'Verification address only', city: 'Madurai', pincode: '625001' }, items: [{ product_id: productId, quantity }], total: 0.01 })
test('rejects invalid quantities and customer details', () => {
  const order = makeOrder(randomUUID())
  assert.throws(() => validateOrder({ ...order, items: [{ ...order.items[0], quantity: -1 }] }))
  assert.throws(() => validateOrder({ ...order, items: [order.items[0], order.items[0]] }))
  assert.throws(() => validateOrder({ ...order, customer: { ...order.customer, phone: '123' } }))
})
test('database checkout uses live prices, saves snapshots, retries safely, and rejects disabled products', { skip: !process.env.DATABASE_URL }, async () => {
  const pool = createPool()
  const client = await pool.connect()
  // Intercept checkout transaction boundaries so every verification row is rolled back.
  const transactionalPool = { connect: async () => ({ query: (sql, values) => ['BEGIN','COMMIT','ROLLBACK'].includes(sql) ? Promise.resolve({ rows: [] }) : client.query(sql, values), release: () => {} }) }
  try {
    await client.query('BEGIN')
    const { rows: [product] } = await client.query('select p.*,c.discountable from public.products p join public.categories c on c.id=p.category_id where p.active and c.discountable order by serial limit 1')
    await client.query('update public.products set discount_percent=25 where id=$1', [product.id])
    const input = makeOrder(product.id)
    const order = await createOrder(transactionalPool, input)
    const expected = Math.round(Number(product.price)*.75*100)*2/100
    assert.equal(order.total, expected)
    const { rows: items } = await client.query('select i.* from public.order_items i join public.orders o on o.id=i.order_id where o.request_id=$1', [input.request_id])
    assert.equal(items.length, 1)
    assert.equal(items[0].quantity, 2)
    assert.equal(Number(items[0].line_total), expected)
    assert.deepEqual(await createOrder(transactionalPool, input), order)
    const { rows: [notifications] } = await client.query('select count(*)::integer as count from public.order_email_notifications n join public.orders o on o.id=n.order_id where o.request_id=$1', [input.request_id])
    assert.equal(notifications.count, 1, 'Retries must not queue duplicate emails')
    await client.query('update public.products set active=false where id=$1', [product.id])
    await assert.rejects(createOrder(transactionalPool, makeOrder(product.id)), /no longer available/)
    await client.query('update public.products set active=true where id=$1', [product.id])
    const { rows: [flatRate] } = await client.query('select p.* from public.products p join public.categories c on c.id=p.category_id where p.active and not c.discountable limit 1')
    await client.query('update public.products set discount_percent=50 where id=$1', [flatRate.id])
    assert.equal((await createOrder(transactionalPool, makeOrder(flatRate.id))).total, Number(flatRate.price)*2)
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end() }
})
