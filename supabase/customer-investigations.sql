-- Which lapsed customers have already been looked into.
--
-- The dashboard works out who has stopped coming; this table remembers who has
-- already been chased, so the same name does not sit there demanding attention
-- every morning.
--
-- last_order_at is the point the investigation was closed at. If the customer
-- later comes back and lapses a second time, their newest order will be after
-- that timestamp, and the case reopens on its own. Closing a case marks one
-- absence, not the customer forever.
--
-- Run this once in the Supabase SQL editor.

create table if not exists salla_customer_investigations (
  customer_id      text primary key,
  last_order_at    timestamptz,
  investigated_by  text not null,
  investigated_at  timestamptz not null default now(),
  note             text
);

-- Only the shop's own server touches this, through the service role key, which
-- bypasses row level security. Enabling it with no policy therefore changes
-- nothing for the dashboard and blocks everything else.
alter table salla_customer_investigations enable row level security;
