import { createPool } from '../_shared/database.ts'
import { createOrder, CheckoutError } from '../_shared/checkout.js'
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }
Deno.serve(async request => {
  const origin=request.headers.get('origin')??''
  const origins=(Deno.env.get('ALLOWED_ORIGINS')??'http://localhost:5173,http://localhost:5174').split(',').map(value=>value.trim())
  const cors={'Access-Control-Allow-Origin':origins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
  if(origin&&!origins.includes(origin))return Response.json({error:'Website origin not allowed.'},{status:403,headers:cors})
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
  if(request.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405,headers:cors})
  let pool: ReturnType<typeof createPool>|undefined
  try {
    const text=await request.text()
    if(new TextEncoder().encode(text).length>65536)return Response.json({error:'Request too large.'},{status:413,headers:cors})
    let body
    try{body=JSON.parse(text)}catch{return Response.json({error:'Invalid request.'},{status:400,headers:cors})}
    pool=createPool()
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown'
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('')
    const {rows}=await pool.query('select public.allow_checkout_attempt($1) as allowed',[hash])
    if(!rows[0].allowed)return Response.json({error:'Too many checkout attempts. Try again later.'},{status:429,headers:cors})
    const result=await createOrder(pool,body)
    // Email failures never turn a committed order into a failed checkout.
    const secret=Deno.env.get('EMAIL_WORKER_SECRET'),url=Deno.env.get('SUPABASE_URL')
    if(secret&&url)EdgeRuntime.waitUntil(fetch(`${url}/functions/v1/order-notifications`,{method:'POST',headers:{'x-email-worker-secret':secret},signal:AbortSignal.timeout(25000)}).then(response=>{if(!response.ok)console.error('Notification worker deferred to retry schedule:',response.status)}).catch(()=>console.error('Notification worker deferred to retry schedule')))
    return Response.json(result,{status:201,headers:cors})
  }catch(error){console.error('Checkout failed:',error instanceof Error?error.name:'Error');return Response.json({error:error instanceof CheckoutError?error.message:'Checkout is temporarily unavailable. Please retry.'},{status:error instanceof CheckoutError?error.status:503,headers:cors})}
  finally{await pool?.end()}
})
