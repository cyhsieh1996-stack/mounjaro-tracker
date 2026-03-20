create extension if not exists pgcrypto;

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  time text not null,
  dose numeric not null,
  injection_site text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  time text not null default '',
  weight numeric not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  total_cholesterol numeric not null,
  hdl numeric not null,
  ldl numeric not null,
  triglycerides numeric not null,
  fasting_glucose numeric not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table medications add column if not exists user_id uuid default auth.uid();
alter table weights add column if not exists user_id uuid default auth.uid();
alter table labs add column if not exists user_id uuid default auth.uid();
alter table weights add column if not exists time text default '';

alter table medications enable row level security;
alter table weights enable row level security;
alter table labs enable row level security;

drop policy if exists "medications_select_own" on medications;
drop policy if exists "medications_insert_own" on medications;
drop policy if exists "medications_update_own" on medications;
drop policy if exists "medications_delete_own" on medications;

drop policy if exists "weights_select_own" on weights;
drop policy if exists "weights_insert_own" on weights;
drop policy if exists "weights_update_own" on weights;
drop policy if exists "weights_delete_own" on weights;

drop policy if exists "labs_select_own" on labs;
drop policy if exists "labs_insert_own" on labs;
drop policy if exists "labs_update_own" on labs;
drop policy if exists "labs_delete_own" on labs;

create policy "medications_select_own"
on medications
for select
to authenticated
using (auth.uid() = user_id);

create policy "medications_insert_own"
on medications
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "medications_update_own"
on medications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "medications_delete_own"
on medications
for delete
to authenticated
using (auth.uid() = user_id);

create policy "weights_select_own"
on weights
for select
to authenticated
using (auth.uid() = user_id);

create policy "weights_insert_own"
on weights
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "weights_update_own"
on weights
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "weights_delete_own"
on weights
for delete
to authenticated
using (auth.uid() = user_id);

create policy "labs_select_own"
on labs
for select
to authenticated
using (auth.uid() = user_id);

create policy "labs_insert_own"
on labs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "labs_update_own"
on labs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "labs_delete_own"
on labs
for delete
to authenticated
using (auth.uid() = user_id);
