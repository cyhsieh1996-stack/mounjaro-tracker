create extension if not exists pgcrypto;

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  dose numeric not null,
  injection_site text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists weights (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  weight numeric not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists labs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  total_cholesterol numeric not null,
  hdl numeric not null,
  ldl numeric not null,
  triglycerides numeric not null,
  fasting_glucose numeric not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table medications enable row level security;
alter table weights enable row level security;
alter table labs enable row level security;

drop policy if exists "shared medications access" on medications;
drop policy if exists "shared weights access" on weights;
drop policy if exists "shared labs access" on labs;

create policy "shared medications access"
on medications
for all
to anon, authenticated
using (true)
with check (true);

create policy "shared weights access"
on weights
for all
to anon, authenticated
using (true)
with check (true);

create policy "shared labs access"
on labs
for all
to anon, authenticated
using (true)
with check (true);
