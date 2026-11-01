-- What the shop has on the shelf: detergent, hangers, bags, covers.
--
-- The count is never stored, only the movements. Whoever brings stock in
-- writes that it came in; whoever uses it writes that it went out; the number
-- on the shelf is the sum. A stored count that two phones update at once is a
-- count that quietly loses one of them, and a sum has no such race.
--
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists salla_stock_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  /* What it is counted in: bottles, boxes, rolls. */
  unit        text,
  /* Show it as running low at or below this many. */
  low_at      numeric(12,3),
  created_by  text not null,
  created_at  timestamptz not null default now(),
  /* Taken off the list. Kept, so its history still reads. */
  removed_at  timestamptz,
  removed_by  text
);

alter table salla_stock_items enable row level security;

-- Every change to a count, signed.
create table if not exists salla_stock_moves (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references salla_stock_items (id) on delete cascade,
  -- 'in' (brought in) | 'used' | 'count' (an owner's correction)
  kind      text not null,
  /* Positive in, negative out. */
  change    numeric(12,3) not null,
  note      text,
  by_staff  text not null,
  at        timestamptz not null default now()
);

create index if not exists salla_stock_moves_item on salla_stock_moves (item_id, at desc);

alter table salla_stock_moves enable row level security;

notify pgrst, 'reload schema';


-- A photo, so an item can be found on the shelf by sight, and a serial, so it
-- can be found by number. The serial is handed out automatically (S001,
-- S002 …) unless whoever adds the item types the one already on the box.
alter table salla_stock_items add column if not exists photo_path text;
alter table salla_stock_items add column if not exists serial text;

create sequence if not exists salla_stock_serial;
alter table salla_stock_items alter column serial
  set default ('S' || lpad(nextval('salla_stock_serial')::text, 3, '0'));
update salla_stock_items set serial = default where serial is null;

create unique index if not exists salla_stock_items_serial
  on salla_stock_items (lower(serial)) where removed_at is null;

notify pgrst, 'reload schema';


-- An item a member of staff adds waits for an owner before it counts. Added
-- with a default so everything already on the list arrives approved, then the
-- default is dropped so nothing new is approved by accident.
alter table salla_stock_items add column if not exists approved_at timestamptz default now();
alter table salla_stock_items alter column approved_at drop default;
alter table salla_stock_items add column if not exists approved_by text;

notify pgrst, 'reload schema';
