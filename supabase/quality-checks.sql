-- Who looked a bag over before it went on the rack.
--
-- A check is the shop's own record and nothing to do with CleanCloud: staff
-- still mark an order ready there, because that is what tells the customer.
-- This only says that somebody checked it, who, and whether that was before
-- or after it was marked ready.
--
-- Nothing here is ever deleted. A check given to the wrong person is
-- corrected or withdrawn, and the correction is written down beside it.
--
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists salla_quality_checks (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null,
  customer_id    text,
  customer_name  text,
  /* Whose PIN was typed. Corrections change this; the log keeps the old one. */
  staff_name     text not null,
  checked_at     timestamptz not null default now(),
  /* CleanCloud's cleanedDate, when the order had one. */
  ready_at       timestamptz,
  /* Checked after the order was already marked ready. */
  late           boolean not null default false,
  /* The dashboard login the PIN was typed on. */
  device_user    text,
  /* Withdrawn by an owner: kept, but no longer counts. */
  removed_at     timestamptz,
  removed_by     text
);

-- One standing check per order. A withdrawn one leaves room for a new one.
create unique index if not exists salla_quality_checks_one_live
  on salla_quality_checks (order_id) where removed_at is null;
create index if not exists salla_quality_checks_at on salla_quality_checks (checked_at desc);
create index if not exists salla_quality_checks_staff on salla_quality_checks (staff_name);

alter table salla_quality_checks enable row level security;


-- Every correction, in the order it was made. Only ever added to.
create table if not exists salla_quality_corrections (
  id          uuid primary key default gen_random_uuid(),
  check_id    uuid not null references salla_quality_checks (id),
  -- 'reassign' | 'remove'
  action      text not null,
  from_staff  text,
  to_staff    text,
  reason      text,
  made_by     text not null,
  made_at     timestamptz not null default now()
);

create index if not exists salla_quality_corrections_check on salla_quality_corrections (check_id, made_at);

alter table salla_quality_corrections enable row level security;


-- A member of staff saying a check is wrong: it was somebody else, or nobody.
--
-- Only a request. Nothing changes until an owner approves it, and then the
-- change is made and logged exactly as if the owner had made it themselves.

create table if not exists salla_quality_requests (
  id            uuid primary key default gen_random_uuid(),
  check_id      uuid not null references salla_quality_checks (id),
  order_id      text not null,
  -- 'reassign' | 'remove'
  action        text not null,
  to_staff      text,
  reason        text,
  /* Whose code was typed to ask. */
  requested_by  text not null,
  requested_at  timestamptz not null default now(),
  -- 'pending' | 'approved' | 'rejected' | 'closed'
  status        text not null default 'pending',
  decided_by    text,
  decided_at    timestamptz
);

-- One open question per check at a time.
create unique index if not exists salla_quality_requests_one_open
  on salla_quality_requests (check_id) where status = 'pending';
create index if not exists salla_quality_requests_status on salla_quality_requests (status, requested_at);

alter table salla_quality_requests enable row level security;

notify pgrst, 'reload schema';
