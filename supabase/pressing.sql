-- Who is pressing which order, and the minutes they earned for it.
--
-- One row per CleanCloud order. Allocated first, then marked done; the
-- minutes are worked out from the garments when it is allocated and are what
-- the person claims when they press done.
--
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists salla_pressing (
  order_id     text primary key,
  customer_id  text,
  /* The item list as it was when allocated, so the report can show it. */
  summary      text,
  minutes      numeric(6,1) not null default 0,
  assigned_to  text,
  assigned_by  text,
  assigned_at  timestamptz,
  done_at      timestamptz,
  done_by      text
);

create index if not exists salla_pressing_done on salla_pressing (done_at);
create index if not exists salla_pressing_open on salla_pressing (assigned_to) where done_at is null;

alter table salla_pressing enable row level security;

notify pgrst, 'reload schema';
