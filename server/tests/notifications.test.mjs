import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverNext, notificationConfig, orderMessage } from '../notifications.mjs'
const order = { order_number: 12, customer_name: 'Customer', customer_phone: '9000000000', total: 40, delivery_address: 'Street', delivery_city: 'Madurai', delivery_pincode: '625001' }
const items = [{ product_name: 'Sparkler', unit: '1 Box', quantity: 2, unit_price: 20, line_total: 40 }]
const config = { to: 'receiver@example.com', from: 'sender@example.com' }
function fakeQueue(attempts=0) {
 const updates=[]
 const pool={connect:async()=>({release(){},async query(sql,values){if(sql.startsWith('select * from public.order_email'))return{rows:[{order_id:'test',attempts}]};if(sql.startsWith('select * from public.orders'))return{rows:[order]};if(sql.startsWith('select * from public.order_items'))return{rows:items};if(sql.startsWith('update'))updates.push({sql,values});return{rows:[]}}})}
 return {pool,updates}
}
test('email contains customer, delivery, items and total without claiming payment',()=>{
 const message=orderMessage(order,items,config)
 assert.equal(message.to,config.to);assert.match(message.subject,/#0012/);assert.match(message.text,/Sparkler/);assert.match(message.text,/Qty 2/);assert.match(message.text,/Madurai/);assert.match(message.text,/No online payment/)
 assert.equal(notificationConfig({}),null)
})
test('accepted mail marks queue entry sent',async()=>{
 const {pool,updates}=fakeQueue();let sends=0
 await deliverNext(pool,config,{sendMail:async()=>{sends++;return{accepted:[config.to],rejected:[]}}})
 assert.equal(sends,1);assert.match(updates[0].sql,/status='sent'/)
})
test('delivery errors retry and stop after five attempts',async()=>{
 for(const attempts of [0,4]){const {pool,updates}=fakeQueue(attempts);await deliverNext(pool,config,{sendMail:async()=>{throw new Error('SMTP unavailable')}});assert.equal(updates[0].values[1],attempts===4?'failed':'pending');assert.equal(updates[0].values[2],attempts+1)}
})

test('Resend configuration works without SMTP settings',()=>{
 const value=notificationConfig({RESEND_API_KEY:'test-key',RESEND_FROM:'sender@example.com',ORDER_NOTIFICATION_EMAIL:'receiver@example.com'})
 assert.equal(value.provider,'resend');assert.equal(value.to,'receiver@example.com')
})

test('HTML template escapes customer and product input',()=>{
 const message=orderMessage({...order,customer_name:'<script>alert(1)</script>'},[{...items[0],product_name:'<img src=x onerror=alert(1)>'}],config)
 assert.match(message.html,/Thangam Crackers/)
 assert.match(message.html,/&lt;script&gt;/)
 assert.ok(!message.html.includes('<script>'))
 assert.ok(!message.html.includes('<img src=x'))
 assert.doesNotMatch(`${message.subject} ${message.html} ${message.text}`,/\bCOD\b|Cash on Delivery/i)
 assert.match(message.html,/QTY/)
})
