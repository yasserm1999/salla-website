import "server-only";
import { createClient } from "@supabase/supabase-js";
import { shopYmd } from "./cleancloud";

/**
 * The errands that make orders, rather than the orders themselves.
 *
 * CleanCloud takes over once an order exists. It has nothing to say about the
 * customer who wants collecting every Tuesday, or the one who rang this
 * morning — and its own pickup handling is not how this shop works. So the
 * round is kept here, and an order is written up in CleanCloud in the usual
 * way once the clothes are actually in the van.
 *
 * A standing arrangement is stored as a rule, not as a thousand future rows:
 * "every seven days from the 3rd, about five o'clock". The day's occurrences
 * are written out the first time that day is looked at, which is what lets a
 * routine's job and a one-off entered by hand be the same kind of thing by the
 * time the driver sees them.
 */

export type JobKind = "pickup" | "delivery";
export type JobStatus = "waiting" | "out" | "done" | "missed";

export type Person = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
};

export type Job = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  /** "HH:MM", or null when no time was promised. */
  atTime: string | null;
  onDate: string;
  note: string | null;
  reason: string | null;
  outAt: string | null;
  doneAt: string | null;
  byStaff: string | null;
  person: Person;
  /** Set when this came from a standing arrangement rather than by hand. */
  routineId: string | null;
  everyDays: number | null;
};

export type Routine = {
  id: string;
  kind: JobKind;
  everyDays: number;
  atTime: string | null;
  startsOn: string;
  active: boolean;
  note: string | null;
  person: Person;
  /** The next day this falls due, on or after today. */
  nextDue: string;
};

export type Store<T> = { ready: true; data: T } | { ready: false; reason: string; data: T };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

const missing = "The pickup tables do not exist yet — run supabase/pickups.sql.";

const DAY = 86_400_000;

/** Whole days between two YYYY-MM-DD dates, ignoring clocks entirely. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);
}

/** Does a routine starting on `startsOn` every `everyDays` fall on `day`? */
export function fallsOn(startsOn: string, everyDays: number, day: string): boolean {
  const gap = daysBetween(startsOn, day);
  return gap >= 0 && gap % everyDays === 0;
}

/** The first day on or after `from` that the routine falls due. */
export function nextDue(startsOn: string, everyDays: number, from: string): string {
  const gap = daysBetween(startsOn, from);
  if (gap <= 0) return startsOn;
  const ahead = (everyDays - (gap % everyDays)) % everyDays;
  return new Date(Date.parse(`${from}T12:00:00Z`) + ahead * DAY).toISOString().slice(0, 10);
}

type PersonRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
};

const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  address: r.address,
  note: r.note,
});

/**
 * Everything on for one day, in the order it should be driven.
 *
 * Occurrences of any standing arrangement due that day are written first, so
 * the driver's list is complete whether or not anybody has opened the page
 * before. Doing it here rather than on a timer means there is no schedule to
 * fail quietly overnight.
 */
export async function loadDay(day: string): Promise<Store<{ jobs: Job[]; people: Person[] }>> {
  const empty = { jobs: [] as Job[], people: [] as Person[] };
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", data: empty };

  const { data: routines, error: routineError } = await db
    .from("salla_routines")
    .select("id, person_id, kind, every_days, at_time, starts_on, active, note")
    .eq("active", true);

  if (routineError) {
    return {
      ready: false,
      reason: isMissingTable(routineError.code) ? missing : routineError.message,
      data: empty,
    };
  }

  const due = (routines ?? []).filter((r) => fallsOn(r.starts_on, r.every_days, day));
  if (due.length > 0) {
    /*
      Upsert rather than insert: the unique index on (routine, day) means a
      second look at the same day changes nothing, so this is safe to run on
      every page load and needs no lock.
    */
    await db.from("salla_jobs").upsert(
      due.map((r) => ({
        person_id: r.person_id,
        routine_id: r.id,
        kind: r.kind,
        on_date: day,
        at_time: r.at_time,
        note: r.note,
      })),
      { onConflict: "routine_id,on_date", ignoreDuplicates: true }
    );
  }

  const [{ data: jobs, error: jobError }, { data: people }] = await Promise.all([
    db
      .from("salla_jobs")
      .select(
        "id, kind, status, at_time, on_date, note, reason, out_at, done_at, by_staff, routine_id, salla_people (id, name, phone, address, note)"
      )
      .eq("on_date", day),
    db.from("salla_people").select("id, name, phone, address, note").order("name"),
  ]);

  if (jobError) {
    return {
      ready: false,
      reason: isMissingTable(jobError.code) ? missing : jobError.message,
      data: empty,
    };
  }

  const everyDaysById = new Map((routines ?? []).map((r) => [r.id, r.every_days as number]));

  const rows: Job[] = (jobs ?? [])
    .filter((j) => j.salla_people)
    .map((j) => ({
      id: String(j.id),
      kind: j.kind as JobKind,
      status: j.status as JobStatus,
      atTime: j.at_time ?? null,
      onDate: String(j.on_date),
      note: j.note ?? null,
      reason: j.reason ?? null,
      outAt: j.out_at ?? null,
      doneAt: j.done_at ?? null,
      byStaff: j.by_staff ?? null,
      person: toPerson(j.salla_people as unknown as PersonRow),
      routineId: j.routine_id ?? null,
      everyDays: j.routine_id ? (everyDaysById.get(j.routine_id) ?? null) : null,
    }))
    .sort(byTime);

  return {
    ready: true,
    data: { jobs: rows, people: (people ?? []).map((p) => toPerson(p as PersonRow)) },
  };
}

/**
 * Down the clock, pickups and deliveries together.
 *
 * Deliberately not grouped by kind: the driver leaves once and does whatever
 * is next, so splitting the list into two would mean reading both and merging
 * them by eye. Anything with no promised time goes last, since it can be
 * fitted around the things that were promised.
 */
function byTime(a: Job, b: Job): number {
  if (a.atTime && b.atTime && a.atTime !== b.atTime) return a.atTime < b.atTime ? -1 : 1;
  if (a.atTime && !b.atTime) return -1;
  if (!a.atTime && b.atTime) return 1;
  return a.person.name.localeCompare(b.person.name);
}

export async function loadRoutines(today: string): Promise<Store<Routine[]>> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", data: [] };

  const { data, error } = await db
    .from("salla_routines")
    .select(
      "id, kind, every_days, at_time, starts_on, active, note, salla_people (id, name, phone, address, note)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { ready: false, reason: isMissingTable(error.code) ? missing : error.message, data: [] };
  }

  const rows: Routine[] = (data ?? [])
    .filter((r) => r.salla_people)
    .map((r) => ({
      id: String(r.id),
      kind: r.kind as JobKind,
      everyDays: r.every_days as number,
      atTime: r.at_time ?? null,
      startsOn: String(r.starts_on),
      active: !!r.active,
      note: r.note ?? null,
      person: toPerson(r.salla_people as unknown as PersonRow),
      nextDue: nextDue(String(r.starts_on), r.every_days as number, today),
    }))
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));

  return { ready: true, data: rows };
}

// ── Writing ────────────────────────────────────────────────────────────

export type Wrote = { ok: true; message: string } | { ok: false; error: string };

function fail(error: { code?: string; message: string }): Wrote {
  return { ok: false, error: isMissingTable(error.code) ? missing : error.message };
}

export async function addPerson(input: {
  name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
}): Promise<Wrote & { id?: string }> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const { data, error } = await db
    .from("salla_people")
    .insert({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return fail(error);
  return { ok: true, message: `${input.name.trim()} added.`, id: String(data.id) };
}

export async function addJob(input: {
  personId: string;
  kind: JobKind;
  onDate: string;
  atTime?: string | null;
  note?: string | null;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const { error } = await db.from("salla_jobs").insert({
    person_id: input.personId,
    kind: input.kind,
    on_date: input.onDate,
    at_time: input.atTime || null,
    note: input.note?.trim() || null,
  });

  if (error) return fail(error);
  return { ok: true, message: "Added to the round." };
}

export async function addRoutine(input: {
  personId: string;
  kind: JobKind;
  everyDays: number;
  atTime?: string | null;
  startsOn: string;
  note?: string | null;
  by: string;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const { error } = await db.from("salla_routines").insert({
    person_id: input.personId,
    kind: input.kind,
    every_days: input.everyDays,
    at_time: input.atTime || null,
    starts_on: input.startsOn,
    note: input.note?.trim() || null,
    created_by: input.by,
  });

  if (error) return fail(error);
  return { ok: true, message: `Repeating every ${input.everyDays} days.` };
}

export async function stopRoutine(id: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  // Kept rather than deleted: the jobs it already made still point at it.
  const { error } = await db.from("salla_routines").update({ active: false }).eq("id", id);
  if (error) return fail(error);
  return { ok: true, message: "Stopped. Days already on the board are untouched." };
}

export async function setJobStatus(input: {
  id: string;
  status: JobStatus;
  reason?: string | null;
  by: string;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, by_staff: input.by };

  if (input.status === "out") {
    patch.out_at = now;
    // Going back out clears an earlier ending, so the row reads as one attempt.
    patch.done_at = null;
    patch.reason = null;
  } else if (input.status === "done" || input.status === "missed") {
    patch.done_at = now;
    patch.reason = input.reason?.trim() || null;
  } else {
    patch.out_at = null;
    patch.done_at = null;
    patch.reason = null;
  }

  const { error } = await db.from("salla_jobs").update(patch).eq("id", input.id);
  if (error) return fail(error);
  return { ok: true, message: "Saved." };
}

/** Today in the shop's own calendar, which is the only day this page means. */
export function shopToday(): string {
  return shopYmd(new Date());
}
