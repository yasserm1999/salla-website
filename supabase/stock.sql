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
