-- Things the shop needs to fix, and ideas for making it better.
--
-- Whoever notices raises it — the driver at the kerb, the washer at the
-- machine, the owner anywhere. It is one list because a fault does not care
-- who found it, and because two lists would mean two places to forget.
--
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists salla_issues (
  id           uuid primary key default gen_random_uuid(),
  -- 'inventory' | 'machinery' | 'customer' | 'other' | 'suggestion'
  kind         text not null,
  description  text not null,
  /* Only on a customer complaint: who it is about. */
  customer_id   text,
  customer_name text,
  /* Where the photo sits in storage, if one was taken. */
  photo_path   text,
  raised_by    text not null,
  raised_at    timestamptz not null default now(),
  -- 'open' | 'doing' | 'done'
  status       text not null default 'open',
  /* Names, not ids: this is a two-owner shop, not an org chart. */
  assigned_to  text[] not null default '{}',
  closed_by    text,
  closed_at    timestamptz
);

create index if not exists salla_issues_status on salla_issues (status);
create index if not exists salla_issues_raised on salla_issues (raised_at desc);

alter table salla_issues enable row level security;


-- What was said about one, in the order it was said.
--
-- Never edited, only added to, so a decision can be read back with the
-- reasoning that led to it rather than only its conclusion.

create table if not exists salla_issue_notes (
  id        uuid primary key default gen_random_uuid(),
  issue_id  uuid not null references salla_issues (id) on delete cascade,
  body      text not null,
  by_staff  text not null,
  at        timestamptz not null default now()
);

create index if not exists salla_issue_notes_issue on salla_issue_notes (issue_id, at);

alter table salla_issue_notes enable row level security;

notify pgrst, 'reload schema';


-- An expense is a report with a figure on it.
--
-- Reusing the same table is deliberate: it is raised the same way by the same
-- people, carries the same photograph of a piece of paper, and is chased the
-- same way. "Done" means paid, which is why the wording changes and the
-- machinery does not.
alter table salla_issues add column if not exists amount numeric(12,3);
