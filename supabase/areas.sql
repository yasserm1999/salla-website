-- Which delivery area each customer lives in, 1 to 7.
--
-- 1 Wadi Kabir · 2 Ruwi / Wattayah · 3 Qurum / Ilam ·
-- 4 MSQ / Khuwair / Qurum 29 · 5 Bausher / Ansab · 6 Ghala · 7 Muscat Hills
--
-- Kept on the customer, not on each errand, because people do not move
-- between bookings. Set once and every later pickup or delivery shows it.
--
-- Run once in the Supabase SQL editor. Safe to run again.

alter table salla_people add column if not exists area smallint
  check (area between 1 and 7);

create index if not exists salla_people_cleancloud on salla_people (cleancloud_id);

notify pgrst, 'reload schema';
