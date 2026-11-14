-- FabriQ cloud save (docs/CLOUD-PLAN.md). One shop = one row in shops; people
-- belong to shops through shop_members. Every row is visible and writable only
-- to members of its shop (row-level security). The app uses the anon key only.

create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  mobile      text not null default '',
  address     text not null default '',
  city        text not null default '',
  gstin       text not null default '',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.shop_members (
  shop_id   uuid not null references public.shops(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  added_at  timestamptz not null default now(),
  primary key (shop_id, user_id)
);

-- Everything the app keeps per shop: jobs, Window systems, sections, offcuts,
-- finish… one table, keyed by kind + the app's own id. `data` is the record as
-- the app stores it; `deleted_at` is a tombstone (kept 30 days, then purged).
create table if not exists public.records (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  kind        text not null check (kind in ('project', 'system', 'profile', 'pref')),
  id          text not null,
  data        jsonb,
  updated_at  timestamptz not null,
  deleted_at  timestamptz,
  updated_by  uuid default auth.uid(),
  -- server time of the last write: phones pull by this, so a change made earlier
  -- offline (older updated_at) still reaches phones that pulled since
  synced_at   timestamptz not null default now(),
  primary key (shop_id, kind, id)
);
create index if not exists records_pull on public.records (shop_id, synced_at);

create or replace function public.is_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members where shop_id = s and user_id = auth.uid());
$$;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.records enable row level security;

drop policy if exists shops_rw on public.shops;
create policy shops_rw on public.shops for all
  using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists members_read on public.shop_members;
create policy members_read on public.shop_members for select
  using (public.is_member(shop_id));

drop policy if exists records_rw on public.records;
create policy records_rw on public.records for all
  using (public.is_member(shop_id)) with check (public.is_member(shop_id));

-- First login: make the person's shop and make them its admin (a new user is not
-- a member of anything yet, so this cannot go through the row rules above).
create or replace function public.create_shop(p_name text, p_mobile text, p_address text, p_city text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  select shop_id into s from shop_members where user_id = auth.uid() limit 1;
  if s is not null then return s; end if;
  insert into shops (name, mobile, address, city) values (p_name, p_mobile, p_address, p_city) returning id into s;
  insert into shop_members (shop_id, user_id, role) values (s, auth.uid(), 'admin');
  return s;
end $$;
revoke all on function public.create_shop(text, text, text, text) from public;
grant execute on function public.create_shop(text, text, text, text) to authenticated;

-- Push: write records only when newer than what the cloud has (the newest wins,
-- per record). Returns how many rows were taken.
create or replace function public.push_records(p_shop uuid, p_rows jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  insert into records as r (shop_id, kind, id, data, updated_at, deleted_at)
  select p_shop, x.kind, x.id, x.data, x.updated_at, x.deleted_at
  from jsonb_to_recordset(p_rows) as x(kind text, id text, data jsonb, updated_at timestamptz, deleted_at timestamptz)
  on conflict (shop_id, kind, id) do update
    set data = excluded.data, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, updated_by = auth.uid(), synced_at = now()
    where r.updated_at < excluded.updated_at;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.push_records(uuid, jsonb) to authenticated;
