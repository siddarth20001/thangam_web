import nodemailer from 'nodemailer'
export function notificationConfig(env = process.env) {
  if (env.RESEND_API_KEY && env.RESEND_FROM && env.ORDER_NOTIFICATION_EMAIL) return { provider: 'resend', key: env.RESEND_API_KEY, from: env.RESEND_FROM, to: env.ORDER_NOTIFICATION_EMAIL }
  const required = ['ORDER_NOTIFICATION_EMAIL','SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_FROM']
  if (required.some(name => !env[name]?.trim())) return null
  return { to: env.ORDER_NOTIFICATION_EMAIL, from: env.SMTP_FROM, host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true', auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
}
export { orderMessage } from '../supabase/functions/_shared/order-template.js'
import { orderMessage } from '../supabase/functions/_shared/order-template.js'
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
export function startNotifications(pool) {
  const config=notificationConfig()
  if (!pool || !config) {
    console.log('Order email notifications awaiting Resend or SMTP configuration; new orders stay queued.')
    return { stop: async () => {} }
  }
  const transport=config.provider==='resend'?{
    async sendMail(message) {
      const {notificationKey,...body}=message
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':notificationKey},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
      if(!response.ok)throw new Error(`Resend HTTP ${response.status}`)
      const result=await response.json()
      if(!result.id)throw new Error('Email not accepted')
      return {accepted:[config.to],rejected:[]}
    },close(){}
  }:nodemailer.createTransport({ host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure,auth:config.auth,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000 })
  let running=null, stopping=false
  function tick() {
    if (running || stopping) return
    running=(async()=>{for(let i=0;i<10&&!stopping;i++){if(!await deliverNext(pool,config,transport))break}})()
      .catch(error=>console.error('Notification queue unavailable:',error.code??error.name))
      .finally(()=>{running=null})
  }
  const timer=setInterval(tick,30000)
  tick()
  return { stop:async()=>{stopping=true;clearInterval(timer);if(running)await running;transport.close()} }
}
