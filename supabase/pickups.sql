-- Pickups and deliveries the shop schedules for itself.
--
-- CleanCloud handles an order once it exists. It does not handle the errand
-- that creates one — the customer who wants collecting every Tuesday, or the
-- one who rang this morning. None of this is sent to CleanCloud; an order is
-- written up there in the usual way once the clothes are actually in the van.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ── The people a round is driven to ──────────────────────────────────
--
-- Kept here rather than read from CleanCloud because CleanCloud can only be
-- asked about a customer by id — there is no way to search it by name or by
-- phone, which is the only way anybody looks somebody up at a counter.

create table if not exists salla_people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  note        text,
  /** Their CleanCloud id, if they are already known there. */
  cleancloud_id text,
  created_at  timestamptz not null default now()
);

create index if not exists salla_people_name on salla_people (lower(name));
create index if not exists salla_people_phone on salla_people (phone);

alter table salla_people enable row level security;


-- ── A standing arrangement ───────────────────────────────────────────
--
-- "Every seven days, about five in the afternoon." The occurrences are worked
-- out from this rather than written years ahead, so changing the interval
-- changes what happens next rather than needing a thousand rows corrected.

create table if not exists salla_routines (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references salla_people (id) on delete cascade,
  -- 'pickup' | 'delivery'
  kind        text not null,
  every_days  integer not null check (every_days between 1 and 180),
  -- 'HH:MM', or null when the time is not fixed.
  at_time     text,
  starts_on   date not null,
  active      boolean not null default true,
  note        text,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists salla_routines_active on salla_routines (active);

alter table salla_routines enable row level security;


-- ── One errand on one day ────────────────────────────────────────────
--
-- Written the first time a day is looked at, so a routine's occurrence and a
-- one-off entered by hand are the same kind of thing by the time the driver
-- sees them. The unique constraint is what makes that safe to do on every page
-- load: asking twice cannot produce the job twice.

create table if not exists salla_jobs (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references salla_people (id) on delete cascade,
  routine_id  uuid references salla_routines (id) on delete set null,
  -- 'pickup' | 'delivery'
  kind        text not null,
  on_date     date not null,
  at_time     text,
  -- 'waiting' | 'out' | 'done' | 'missed'
  status      text not null default 'waiting',
  note        text,
  reason      text,
  out_at      timestamptz,
  done_at     timestamptz,
  by_staff    text,
  created_at  timestamptz not null default now()
);

create unique index if not exists salla_jobs_one_per_routine_per_day
  on salla_jobs (routine_id, on_date) where routine_id is not null;

create index if not exists salla_jobs_day on salla_jobs (on_date);

alter table salla_jobs enable row level security;

notify pgrst, 'reload schema';


-- Stopping a standing arrangement, and why.
--
-- A repeat that simply vanishes leaves nobody able to say whether the
-- customer cancelled, moved, or was dropped by mistake.

alter table salla_routines add column if not exists stopped_reason text;
alter table salla_routines add column if not exists stopped_at timestamptz;
alter table salla_routines add column if not exists stopped_by text;
