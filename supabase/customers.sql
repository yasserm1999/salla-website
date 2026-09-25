-- Customers signing in for themselves.
--
-- There is no account table: every customer in CleanCloud can already sign in,
-- with a password worked out from their name and number. These two tables hold
-- only what that arrangement cannot — a password somebody has changed, and the
-- recent guesses, so the door can be shut on someone trying numbers in turn.

create table if not exists salla_customer_logins (
  /* The CleanCloud customer number. */
  customer_id    text primary key,
  /* scrypt: salt:hash. Only here once a customer sets their own. */
  password_hash  text not null,
  changed_at     timestamptz not null default now()
);

alter table salla_customer_logins enable row level security;


-- One row per attempt, kept briefly.
--
-- Counted two ways: by who was being guessed at, and by where the guessing
-- came from. A shared office address must not lock out a whole street, and a
-- customer must not be locked out of their own account by somebody else's
-- clumsiness — so neither count alone is allowed to bar the door for long.
create table if not exists salla_login_tries (
  id          bigserial primary key,
  /* "id:216" or "ip:<hash>" */
  subject     text not null,
  at          timestamptz not null default now(),
  ok          boolean not null default false
);

create index if not exists salla_login_tries_subject on salla_login_tries (subject, at desc);

alter table salla_login_tries enable row level security;


-- Errands the customer asked for themselves.
--
-- They go into the same list the shop already works from; this only records
-- that nobody in the shop wrote it down, so the board can say so.
alter table salla_jobs add column if not exists from_customer boolean not null default false;

notify pgrst, 'reload schema';
