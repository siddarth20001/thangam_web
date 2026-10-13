import {createPool} from '../_shared/database.ts'
import {deliverNext} from '../_shared/notifications.js'
import {emailConfig,resendTransport} from '../_shared/resend.ts'
Deno.serve(async request=>{
  const secret=Deno.env.get('EMAIL_WORKER_SECRET')
  if(!secret||request.headers.get('x-email-worker-secret')!==secret)return Response.json({error:'Unauthorized'},{status:401})
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405})
  let pool:ReturnType<typeof createPool>|undefined
  try{
    const config=emailConfig();pool=createPool()
    let processed=0
    while(processed<5&&await deliverNext(pool,config,resendTransport(config)))processed++
    return Response.json({processed})
  }catch(error){console.error('Email worker unavailable:',error instanceof Error?error.name:'Error');return Response.json({error:'Email worker unavailable. Check function secrets and logs.'},{status:503})}
  finally{await pool?.end()}
})
