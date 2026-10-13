BEGIN;
create table if not exists public.checkout_rate_limits (
  key text primary key,
  started_at timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.checkout_rate_limits enable row level security;
create or replace function public.allow_checkout_attempt(p_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare attempt integer;
begin
  delete from public.checkout_rate_limits where started_at < now()-interval '1 day';
  insert into public.checkout_rate_limits(key) values(p_key)
  on conflict(key) do update set
    attempts=case when public.checkout_rate_limits.started_at < now()-interval '15 minutes' then 1 else public.checkout_rate_limits.attempts+1 end,
    started_at=case when public.checkout_rate_limits.started_at < now()-interval '15 minutes' then now() else public.checkout_rate_limits.started_at end
  returning attempts into attempt;
  return attempt <= 30;
end;
$$;
revoke all on function public.allow_checkout_attempt(text) from public, anon, authenticated;
grant execute on function public.allow_checkout_attempt(text) to service_role;
COMMIT;
