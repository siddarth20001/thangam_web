BEGIN;
alter table public.orders add column if not exists payment_method text not null default 'cod' check (payment_method = 'cod');
COMMIT;
