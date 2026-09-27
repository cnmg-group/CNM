-- CNM Essentials — database for orders, customers, enquiries, subscribers, inventory and content.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (or `supabase db push`).
--
-- Every record is a JSON document in cnm_kv, written only by the Netlify functions using the server-side
-- secret key. Row Level Security is ON with NO policies, so the publishable (anon) key can neither read nor write it.
-- The cnm_* views below make the data easy to browse in the Supabase Table Editor.

create table if not exists public.cnm_kv (
  store      text        not null,
  key        text        not null,
  value      jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store, key)
);

create index if not exists cnm_kv_store_key_prefix on public.cnm_kv (store, key text_pattern_ops);

create or replace function public.cnm_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists cnm_kv_touch on public.cnm_kv;
create trigger cnm_kv_touch before update on public.cnm_kv
  for each row execute function public.cnm_touch_updated_at();

alter table public.cnm_kv enable row level security;
revoke all on public.cnm_kv from anon, authenticated;

-- Read-only views for the dashboard (security_invoker: they obey the table's RLS, so anon sees nothing).
create or replace view public.cnm_orders with (security_invoker = true) as
select
  value->>'number'                        as number,
  value->>'status'                        as status,
  (value->'totals'->>'total')::numeric    as total_ngn,
  value->'contact'->>'firstName' || ' ' || coalesce(value->'contact'->>'lastName', '') as customer,
  value->'contact'->>'email'              as email,
  value->'contact'->>'phone'              as phone,
  value->'delivery'->>'label'             as delivery,
  value->'payment'->>'provider'           as payment_provider,
  value->'payment'->>'reference'          as payment_reference,
  (value->>'createdAt')::timestamptz      as created_at,
  value                                   as raw
from public.cnm_kv where store = 'orders' and key like 'order/%';

create or replace view public.cnm_customers with (security_invoker = true) as
select
  value->>'id'                            as id,
  value->>'email'                         as email,
  value->>'firstName'                     as first_name,
  value->>'lastName'                      as last_name,
  value->>'phone'                         as phone,
  (value->>'createdAt')::timestamptz      as created_at,
  (value->>'emailVerifiedAt')::timestamptz as email_verified_at
from public.cnm_kv where store = 'users' and key like 'user/%';

create or replace view public.cnm_enquiries with (security_invoker = true) as
select
  value->>'id' as id, value->>'status' as status, value->>'sector' as sector, value->>'subject' as subject,
  value->>'name' as name, value->>'email' as email, value->>'phone' as phone, value->>'company' as company,
  value->>'message' as message, (value->>'createdAt')::timestamptz as created_at
from public.cnm_kv where store = 'leads' and key like 'enquiry/%';

create or replace view public.cnm_subscribers with (security_invoker = true) as
select value->>'email' as email, value->>'source' as source, (value->>'consentAt')::timestamptz as consent_at
from public.cnm_kv where store = 'leads' and key like 'newsletter/%';

revoke all on public.cnm_orders, public.cnm_customers, public.cnm_enquiries, public.cnm_subscribers from anon, authenticated;
