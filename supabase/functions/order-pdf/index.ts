import {createPool} from '../_shared/database.ts'
import {verifyOrderSignature} from '../_shared/order-link.js'
import {orderPdfAttachment} from '../_shared/order-pdf-attachment.ts'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
Deno.serve(async request=>{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405})
  const url=new URL(request.url),orderId=url.searchParams.get('order')??'',secret=Deno.env.get('EMAIL_WORKER_SECRET')
  if(!secret||!uuid.test(orderId)||!await verifyOrderSignature(orderId,url.searchParams.get('sig'),secret))return new Response('This download link is not valid.',{status:403})
  let pool:ReturnType<typeof createPool>|undefined
  try{
    pool=createPool()
    const {rows:[order]}=await pool.query('select * from public.orders where id=$1',[orderId])
    if(!order)return new Response('Order not found.',{status:404})
    const {rows:items}=await pool.query('select * from public.order_items where order_id=$1 order by product_name',[orderId])
    const pdf=await orderPdfAttachment(order,items)
    return new Response(Uint8Array.from(atob(pdf.content),character=>character.charCodeAt(0)),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${pdf.filename}"`,'Cache-Control':'private, no-store'}})
  }catch(error){console.error('Order PDF failed:',error instanceof Error?error.name:'Error');return new Response('The PDF could not be created. Please try again.',{status:503})}
  finally{await pool?.end()}
})
