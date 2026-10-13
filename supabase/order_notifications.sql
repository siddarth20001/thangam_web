BEGIN;
create table public.order_email_notifications (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.order_email_notifications enable row level security;
-- Only the trusted checkout server can process this queue. No public access.
COMMIT;
