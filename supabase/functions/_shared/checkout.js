const randomUUID = () => crypto.randomUUID()
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export class CheckoutError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
const minimumOrderCents = 200000
export function assertMinimumOrder(totalCents) {
  if (totalCents < minimumOrderCents) throw new CheckoutError('Minimum order value is ₹2,000.')
}
function text(value, min, max, label) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new CheckoutError(`Enter a valid ${label}.`)
  return value.trim()
}
export function validateOrder(body) {
  if (!body || typeof body !== 'object') throw new CheckoutError('Invalid order.')
  const customer = body.customer ?? {}
  const name = text(customer.name, 2, 120, 'name')
  const phone = text(customer.phone, 10, 20, 'phone number').replace(/[\s()-]/g, '')
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(phone)) throw new CheckoutError('Enter a valid Indian mobile number.')
  const address = text(customer.address, 8, 500, 'delivery address')
  const city = text(customer.city, 2, 100, 'city')
  const pincode = text(customer.pincode, 6, 6, 'PIN code')
  if (!/^[1-9]\d{5}$/.test(pincode)) throw new CheckoutError('Enter a valid six-digit PIN code.')
  const email = customer.email ? text(customer.email, 3, 254, 'email') : null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError('Enter a valid email address.')
  if (!uuid.test(body.request_id ?? '')) throw new CheckoutError('Invalid checkout request. Refresh and try again.')
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 200) throw new CheckoutError('Select between 1 and 200 products.')
  const ids = new Set()
  const items = body.items.map(item => {
    if (!item || !uuid.test(item.product_id ?? '') || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999 || ids.has(item.product_id)) throw new CheckoutError('Invalid product or quantity.')
    ids.add(item.product_id)
    return { product_id: item.product_id, quantity: item.quantity }
  })
  return { name, phone, address, city, pincode, email, items, request_id: body.request_id }
}
export async function createOrder(pool, body) {
  const input = validateOrder(body)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Serialize retries for the same checkout without trusting a client-provided total.
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [input.request_id])
    const existing = await client.query('select order_number, total from public.orders where request_id=$1', [input.request_id])
    if (existing.rows.length) { await client.query('COMMIT'); return { order_number: existing.rows[0].order_number, total: Number(existing.rows[0].total) } }
    const { rows } = await client.query('select p.*, c.discountable from public.products p join public.categories c on c.id=p.category_id where p.id=any($1::uuid[]) for share of p, c', [input.items.map(item => item.product_id)])
    const items = input.items.map(item => {
      const product = rows.find(product => product.id === item.product_id)
      if (!product || !product.active) throw new CheckoutError('A product is no longer available. Refresh your cart.', 409)
      const discount = product.discountable ? Number(product.discount_percent ?? 0) : 0
      const cents = Math.round(Number(product.price) * (1 - discount / 100) * 100)
      return { ...item, product, discount, cents, totalCents: cents * item.quantity }
    })
    const totalCents = items.reduce((total, item) => total + item.totalCents, 0)
    if (!Number.isSafeInteger(totalCents) || totalCents > 999999999999) throw new CheckoutError('Order total is too large.')
    assertMinimumOrder(totalCents)
    const id = randomUUID()
    const { rows: order } = await client.query(`insert into public.orders(id, customer_name, customer_phone, customer_email, total, delivery_address, delivery_city, delivery_pincode, request_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning order_number`, [id,input.name,input.phone,input.email,totalCents/100,input.address,input.city,input.pincode,input.request_id])
    for (const item of items) await client.query(`insert into public.order_items(order_id,product_id,product_name,unit,quantity,original_price,discount_percent,unit_price,line_total) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id,item.product.id,item.product.name,item.product.unit,item.quantity,item.product.price,item.discount,item.cents/100,item.totalCents/100])
    await client.query('insert into public.order_email_notifications(order_id) values($1) on conflict do nothing', [id])
    await client.query('COMMIT')
    return { order_number: order[0].order_number, total: totalCents/100 }
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
