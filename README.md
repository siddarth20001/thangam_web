# Thangam website

React + TypeScript + Vite storefront connected to the same Supabase project as `thangam_admin`. Includes the supplied logo, live products/categories, category and price filters, percentage discounts, a persistent cart, and order-request checkout.

## Run locally

```sh
npm install
npm run dev
```

This starts Vite plus the Node checkout server on port 3001. Open the Local URL printed by Vite; when the admin is already on 5173, Vite selects the next available port. The `/api` development proxy forwards checkout requests to port 3001. Stop both with Ctrl+C.

The ignored `.env` is configured for the existing Supabase project. `.env.example` lists the required variables. Only the two `VITE_SUPABASE_*` variables are sent to the browser. `DATABASE_URL` is server-only. The bundled public Supabase CA enables verified database TLS.

## Catalog behavior

Only active products are loaded. Catalog data refreshes every 30 seconds while the tab is visible and whenever the window regains focus. Products switched OFF in admin are removed from the catalog and cart on refresh. Discounts apply only when the category allows them; flat-rate categories retain their original price. Cart quantities persist in localStorage and product prices are always refreshed from Supabase.

The decorative product illustrations are category symbols, not product photography. Business contact information comes from the supplied 2026 PDF. Cash on Delivery follows the owner’s instructions and supersedes the PDF’s advance-payment terms.

## Checkout and admin orders

`POST /api/orders` validates contact details and quantities, locks and reads current products/categories, rejects OFF products, and recalculates all totals from database prices. Client-provided prices and totals are ignored. Orders and price/item snapshots are saved together in one database transaction. A request UUID makes retries return the same order. Endpoint rate limiting is applied per client IP.

The checkout migration is in `supabase/checkout.sql` and has already been applied to the connected database. For a new environment, apply the admin schema and migrations first, then this checkout migration once. No sample orders are stored. The admin Orders page reads these orders from the shared database. `order_items` stores product names, units, quantities, original and discounted prices at order time, so later catalog edits do not alter order history.

Checkout sends an order request; there is no online payment integration. Orders default to pending. Customers pay cash on delivery. The team confirms delivery charges separately. Product totals exclude those delivery charges.

## Production

```sh
npm run build
npm start
```

The Node server serves both `dist` and `/api/orders` on `PORT` (default 3001). Set the server environment variables on the hosting provider; configure the two public variables at build time. Use a Node-capable host. Deploying only `dist` to a static host does not deploy checkout. A reverse proxy should forward the website and API to the Node server; rate-limiter proxy settings must be configured for that host's actual proxy topology before relying on client-IP limits.

## Verification

```sh
npm run build
npm test
```

Checkout tests exercise database pricing, disabled products, flat-rate discounts, snapshots, and idempotent retries inside a rolled-back transaction. Database identity numbers can have gaps after rollback tests. No verification orders remain.

## New-order email notifications

New website orders save a notification queue row in the same database transaction as the order and items. The background worker sends email after submission. Configure the following server-only variables in `.env` (placeholders have been added):

```env
ORDER_NOTIFICATION_EMAIL=recipient@example.com
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-login
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=Thangam Traders <your-verified-sender@example.com>
```

Use the SMTP provider's authorized sender and credential (an app password if required). Port 465 generally uses `SMTP_SECURE=true`; port 587 uses `false` with required STARTTLS. Restart the server after setting these values. No SMTP credentials are exposed to the browser.

The worker checks every 30 seconds and sends order number, contact details, delivery address, items and product total. If sending fails, it retries with increasing delays, up to five attempts. Jobs survive server restarts. Without configuration, new jobs remain queued and the checkout still succeeds. Migration `supabase/order_notifications.sql` has been applied to the connected database; apply once in new environments. Existing orders are not retroactively emailed.

Inspect failed jobs using the Supabase SQL editor:

```sql
select order_id, status, attempts, sent_at
from public.order_email_notifications
order by created_at desc;
```

After fixing SMTP configuration, retry failed jobs with:

```sql
update public.order_email_notifications
set status = 'pending', attempts = 0, next_attempt_at = now()
where status = 'failed';
```

SMTP acceptance does not guarantee inbox delivery. There is a small duplicate-delivery window if the server stops after SMTP accepts a message but before the sent status is committed. A continuously running Node server is required for the worker.

## Quick Order

Open `/quick-order` or click Quick Order in the website navigation. Active products appear in a compact list with selling units, current discounted prices, selection checkboxes, quantity inputs and line amounts. Selected products use the same persisted bag as the main shop; filters do not remove existing selections. A fixed bottom bar shows the full selected total and routes to `/checkout`, which displays the selected products, total and COD delivery form. Browser Back returns to Quick Order with selections intact. The server still calculates the final total from current database prices.

Both paths use client-side navigation and need SPA fallback to `index.html` when deployed. The Node server and Vite development server already provide this fallback.

## Cloudflare Pages and Supabase Edge Functions

See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) for the prepared SMTP-free deployment. `npm run deploy:edge` requires a Supabase access token, Resend API key, and verified sender. The recipient is already configured as thangamcrackersonline@gmail.com. The Node checkout remains the local fallback until Edge deployment succeeds; do not set `VITE_USE_SUPABASE_CHECKOUT=true` before deployment. Function handlers are under `supabase/functions/`. Pending emails are retained.
