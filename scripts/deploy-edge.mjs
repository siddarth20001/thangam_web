import 'dotenv/config'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createPool} from '../server/database.mjs'
const needed=['SUPABASE_ACCESS_TOKEN','RESEND_API_KEY','RESEND_FROM','ORDER_NOTIFICATION_EMAIL','EMAIL_WORKER_SECRET','DATABASE_URL','VITE_SUPABASE_URL','ALLOWED_ORIGINS']
const missing=needed.filter(name=>!process.env[name]?.trim())
if(missing.length){console.log('Missing settings: '+missing.join(', '));process.exit(1)}
const project=new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0]
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'thangam-edge-'))
const secretFile=path.join(dir,'secrets.env')
const secrets={RESEND_API_KEY:process.env.RESEND_API_KEY,RESEND_FROM:process.env.RESEND_FROM,ORDER_NOTIFICATION_EMAIL:process.env.ORDER_NOTIFICATION_EMAIL,EMAIL_WORKER_SECRET:process.env.EMAIL_WORKER_SECRET,ORDER_DATABASE_URL:process.env.DATABASE_URL,ALLOWED_ORIGINS:process.env.ALLOWED_ORIGINS}
fs.writeFileSync(secretFile,Object.entries(secrets).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n'),{mode:0o600})
function cli(args){const r=spawnSync('npx',['--yes','supabase',...args],{env:process.env,encoding:'utf8',timeout:120000});if(r.status!==0)throw new Error('Supabase CLI failed. Check token permissions and project access.');console.log('Completed: '+args.slice(0,3).filter(arg=>!arg.startsWith('/')).join(' '))}
let pool
try{
  pool=createPool()
  await pool.query(fs.readFileSync('supabase/edge_checkout.sql','utf8'))
  cli(['secrets','set','--project-ref',project,'--env-file',secretFile])
  for(const name of ['create-order','order-notifications'])cli(['functions','deploy',name,'--project-ref',project,'--no-verify-jwt','--use-api'])
  // Cron stores the worker credential in Vault, never in tracked SQL or cron command text.
  await pool.query('create extension if not exists pg_cron')
  await pool.query('create extension if not exists pg_net')
  await pool.query('BEGIN')
  for(const [name,value] of Object.entries({thangam_email_worker_url:process.env.VITE_SUPABASE_URL+'/functions/v1/order-notifications',thangam_email_worker_secret:process.env.EMAIL_WORKER_SECRET})){
    const {rows}=await pool.query('select id from vault.secrets where name=$1',[name])
    if(rows.length)await pool.query('select vault.update_secret($1,$2,$3)',[rows[0].id,value,name])
    else await pool.query('select vault.create_secret($1,$2)',[value,name])
  }
  await pool.query("select cron.unschedule(jobid) from cron.job where jobname='thangam-order-notifications'")
  await pool.query(`select cron.schedule('thangam-order-notifications','* * * * *',$1)`,["select net.http_post(url:=(select decrypted_secret from vault.decrypted_secrets where name='thangam_email_worker_url'), headers:=jsonb_build_object('Content-Type','application/json','x-email-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='thangam_email_worker_secret')),body:='{}'::jsonb,timeout_milliseconds:=10000);"])
  await pool.query('COMMIT')
  const response=await fetch(process.env.VITE_SUPABASE_URL+'/functions/v1/order-notifications',{method:'POST',headers:{'x-email-worker-secret':process.env.EMAIL_WORKER_SECRET},signal:AbortSignal.timeout(60000)})
  if(!response.ok)throw new Error('Functions deployed, but email worker check failed (HTTP '+response.status+'). Inspect Edge Function logs.')
  console.log('Email worker processed pending queue; inspect notification status for send results.')
  let env=fs.readFileSync('.env','utf8');env=env.replace(/^VITE_USE_SUPABASE_CHECKOUT=.*$/m,'VITE_USE_SUPABASE_CHECKOUT=true');fs.writeFileSync('.env',env,{mode:0o600})
  console.log('Deployment complete. Checkout enabled for Edge Functions locally. Set VITE_USE_SUPABASE_CHECKOUT=true in Cloudflare Pages too.')
}catch(error){if(pool)await pool.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1}
finally{await pool?.end();fs.rmSync(dir,{recursive:true,force:true})}
