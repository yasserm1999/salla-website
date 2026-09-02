-- Everything the dashboard needs from Supabase, in one paste.
--
-- Run this once in the Supabase SQL editor. It is safe to run again: every
-- statement checks first.
--
-- Only the shop's own server touches these tables, through the service role
-- key, which bypasses row level security. Enabling RLS with no policy
-- therefore changes nothing for the dashboard and blocks everything else.

-- ── Which lapsed customers have already been chased ──────────────────
--
-- The dashboard works out who has stopped coming; this remembers who has been
-- looked into, so the same name does not demand attention every morning.
--
-- last_order_at is the order the case was closed against. If the customer
-- comes back and lapses a second time their newest order is after it, and the
-- case reopens on its own — closing a case files one absence, not the person.

create table if not exists salla_customer_investigations (
  customer_id      text primary key,
  last_order_at    timestamptz,
  investigated_by  text not null,
  investigated_at  timestamptz not null default now(),
  note             text
);

alter table salla_customer_investigations enable row level security;


-- ── What the driver is doing ─────────────────────────────────────────
--
-- One row per thing that happened: the van left, a parcel is on its way, a
-- parcel arrived, a parcel could not be delivered. Never updated, only added
-- to, so the day can be reconstructed exactly as it went.
--
-- The two timestamps are the point of the table. happened_at is the driver's
-- own clock at the moment he tapped; recorded_at is when it reached the
-- server. Out of signal those differ, and the difference is the honest measure
-- of how stale the shop's view was.

create table if not exists salla_delivery_events (
  id           bigserial primary key,
  -- Null for events about the whole run rather than one parcel.
  order_id     text,
  run_day      date not null,
  -- 'run_started' | 'on_the_way' | 'delivered' | 'failed'
  event        text not null,
  reason       text,
  by_staff     text not null,
  happened_at  timestamptz not null,
  recorded_at  timestamptz not null default now()
);

create index if not exists salla_delivery_events_day on salla_delivery_events (run_day);
create index if not exists salla_delivery_events_order on salla_delivery_events (order_id);

alter table salla_delivery_events enable row level security;
