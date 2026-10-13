export function emailConfig() {
  const key=Deno.env.get('RESEND_API_KEY'), from=Deno.env.get('RESEND_FROM'), to=Deno.env.get('ORDER_NOTIFICATION_EMAIL')
  if(!key||!from||!to) throw new Error('Email configuration missing')
  return {key,from,to}
}
export function resendTransport(config: ReturnType<typeof emailConfig>) {
  return { async sendMail(message: { from: string; to: string; subject: string; html: string; text: string; notificationKey: string }) {
    const {notificationKey,...body}=message
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':notificationKey},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
    if(!response.ok) throw new Error(`Resend HTTP ${response.status}`)
    const data=await response.json()
    if(!data.id)throw new Error('Email not accepted')
    return {accepted:[config.to],rejected:[]}
  }}
}
