-- The bell a customer rings from the car park.
--
-- Two tables: every ring ever rung, and the devices Sonu has told to buzz.
-- Rows are written and read by the server with the service key; row level
-- security is on and no policy is granted to anyone else.

create table if not exists salla_bell_rings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  /* The phone that rang, as it calls itself. Used for the two-minute rule. */
  device_id      text not null,
  /* Never the address itself — only enough to spot one machine ringing all day. */
  ip_hash        text,
  /* What the customer typed, if anything. */
  asked          text,
  /* What that turned out to be. Null when nothing matched. */
  customer_id    text,
  customer_name  text,
  /* en | ar — which language the car park was reading. */
  lang           text not null default 'en',
  /* When somebody inside said they were coming, and who. */
  ack_at         timestamptz,
  ack_by         text
);

create index if not exists salla_bell_rings_recent on salla_bell_rings (created_at desc);
create index if not exists salla_bell_rings_device on salla_bell_rings (device_id, created_at desc);

alter table salla_bell_rings enable row level security;


-- A browser that has agreed to be buzzed.
--
-- One row per device per member of staff: the tablet on the wall and the
-- phone in the pocket are two subscriptions, and both should ring.
create table if not exists salla_bell_devices (
  endpoint    text primary key,
  staff       text not null,
  p256dh      text not null,
  auth        text not null,
  /* What it calls itself, so a dead tablet can be recognised in the list. */
  label       text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create index if not exists salla_bell_devices_staff on salla_bell_devices (staff);

alter table salla_bell_devices enable row level security;

notify pgrst, 'reload schema';
