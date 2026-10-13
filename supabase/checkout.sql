BEGIN;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_city text;
alter table public.orders add column if not exists delivery_pincode text;
alter table public.orders add column if not exists request_id uuid unique;
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit text not null,
  quantity integer not null check (quantity > 0),
  original_price numeric(12,2) not null check (original_price >= 0),
  discount_percent numeric(5,2) not null check (discount_percent >= 0 and discount_percent <= 100),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index on public.order_items(order_id);
alter table public.order_items enable row level security;
grant select on public.order_items to authenticated;
create policy "Admins can read order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
COMMIT;
