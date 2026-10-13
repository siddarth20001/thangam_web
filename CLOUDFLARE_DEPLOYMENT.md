# Cloudflare Pages + Supabase checkout and order emails

Both frontends can be hosted as static Vite apps on Cloudflare Pages. The website's checkout and notification delivery run in Supabase Edge Functions. No Node server or SMTP service is required on Cloudflare.

## Complete the email setup

In the website's private `.env`, set:

```env
SUPABASE_ACCESS_TOKEN=your-supabase-personal-access-token
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM=Thangam Traders <orders@your-verified-domain.com>
ORDER_NOTIFICATION_EMAIL=thangamcrackersonline@gmail.com
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,https://your-website.pages.dev,https://your-website-domain.com
```

Create the Supabase personal access token at https://supabase.com/dashboard/account/tokens. Create a Resend API key and verify a sender domain in Resend. The recipient address does not need to be the sender domain. Resend's test sender has recipient restrictions, so use a verified domain for production.

`DATABASE_URL` and `EMAIL_WORKER_SECRET` are already present locally. Never prefix any of these private credentials with `VITE_` or add them to Git.

From the website repository, run:

```sh
npm run deploy:edge
```

The script checks all required settings before changing anything, applies the checkout rate-limit migration, uploads function secrets, deploys create-order and order-notifications, configures one-minute queue retries with pg_cron/pg_net and Vault, and processes pending order notifications. It preserves existing orders and the notification queue. Function deployment requires the account token to have access to this Supabase project. Email dispatch is authorized by a dedicated worker secret; checkout is public and validates customer data, products and current prices on the server.

After successful deployment, the script sets local `VITE_USE_SUPABASE_CHECKOUT=true`. Restart Vite. Check `public.order_email_notifications` for `sent`/`sent_at`, and inspect Edge Function logs for failures. SMTP credentials are ignored when local Resend configuration is provided; the local Node server can also deliver queued messages through Resend while you complete deployment.

## Cloudflare Pages configuration

Create one Pages project per repository. For both projects:

- Build command: `npm run build`
- Output directory: `dist`
- Public build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

For the **website**, also set `VITE_USE_SUPABASE_CHECKOUT=true`. Include its exact deployed origin in `ALLOWED_ORIGINS`, then redeploy function secrets. Only approved origins receive checkout CORS headers; add specific preview origins if you intend to test preview builds. Do not expose database, email or deployment credentials as frontend variables.

The admin does not need email credentials or a checkout server. It reads orders through its existing admin-only Supabase policies.

## How emails are sent

1. Checkout writes the order, line items and notification entry in one transaction.
2. The checkout function asks the email worker to process the queue.
3. Resend sends the order details to thangamcrackersonline@gmail.com.
4. The one-minute retry schedule catches pending jobs after failures or interruptions.

Delivery errors preserve the order and retry with increasing delays, up to five attempts. Resend idempotency keys reduce duplicates from retries; its deduplication window is finite. SMTP/API acceptance does not guarantee inbox placement. Old pending orders are intentionally processed when email is configured.

The private temporary file used to upload secrets is mode 0600 and removed after deployment. Cron credentials live in Supabase Vault, not tracked SQL. Deployment does not publish the Cloudflare websites; use the Cloudflare dashboard/Git integration for that step.
