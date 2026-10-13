export { orderMessage } from './order-template.js'
import { orderMessage } from './order-template.js'
export async function deliverNext(pool, config, transport) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [job] } = await client.query("select * from public.order_email_notifications where status='pending' and next_attempt_at <= now() order by created_at for update skip locked limit 1")
    if (!job) { await client.query('COMMIT'); return false }
    const { rows: [order] } = await client.query('select * from public.orders where id=$1', [job.order_id])
    const { rows: items } = await client.query('select * from public.order_items where order_id=$1 order by product_name', [job.order_id])
    try {
      const result = await transport.sendMail(orderMessage(order, items, config))
      if (result.rejected?.length || !result.accepted?.length) throw new Error('Recipient rejected')
      await client.query("update public.order_email_notifications set status='sent',sent_at=now(),attempts=attempts+1 where order_id=$1",[job.order_id])
    } catch {
      const attempts = job.attempts+1
      await client.query("update public.order_email_notifications set status=$2,attempts=$3,next_attempt_at=now()+($4 * interval '1 second') where order_id=$1",[job.order_id,attempts>=5?'failed':'pending',attempts,Math.min(3600,60*2**(attempts-1))])
      console.error('Order notification failed; '+(attempts>=5?'retry limit reached.':'queued for retry.'))
    }
    await client.query('COMMIT')
    return true
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
