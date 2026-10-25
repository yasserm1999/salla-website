import "server-only";
import { createClient } from "@supabase/supabase-js";
import { QUALITY_STAFF } from "@/config/quality-staff";
import { fetchOrders, STATUS } from "./cleancloud";

/**
 * Quality checks: who looked a bag over, and when.
 *
 * Kept entirely apart from CleanCloud. Marking an order ready there is what
 * sends the customer their message, so this never touches an order's status —
 * it only writes down that somebody checked it. A check made after the order
 * was already marked ready is flagged late: the customer may have been told
 * it was done before anybody had looked.
 *
 * If the tables are missing the dashboard still opens; the circles simply
 * say why they cannot be used.
 */

const CHECKS = "salla_quality_checks";
const CORRECTIONS = "salla_quality_corrections";

export type Correction = {
  action: "reassign" | "remove";
  fromStaff: string | null;
  toStaff: string | null;
  reason: string | null;
  madeBy: string;
  madeAt: string;
};

export type Check = {
  id: string;
  orderId: string;
  customerId: string | null;
  customerName: string | null;
  staff: string;
  checkedAt: string;
  readyAt: string | null;
  late: boolean;
  deviceUser: string | null;
  removedAt: string | null;
  removedBy: string | null;
  corrections: Correction[];
};

/** What a circle on the board needs to draw itself. */
export type CheckMark = { id: string; staff: string; at: string; late: boolean };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const isMissingTable = (code: string | undefined) => code === "42P01" || code === "PGRST205";
const MISSING = `The ${CHECKS} table does not exist yet — run supabase/quality-checks.sql.`;

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

const toCheck = (r: Row, corrections: Correction[] = []): Check => ({
  id: String(r.id),
  orderId: String(r.order_id),
  customerId: str(r.customer_id),
  customerName: str(r.customer_name),
  staff: String(r.staff_name),
  checkedAt: String(r.checked_at),
  readyAt: str(r.ready_at),
  late: Boolean(r.late),
  deviceUser: str(r.device_user),
  removedAt: str(r.removed_at),
  removedBy: str(r.removed_by),
  corrections,
});

/** The names, for menus. The PINs never leave the server. */
export const qualityStaffNames = () => QUALITY_STAFF.map((s) => s.name);

export function staffForPin(pin: string): string | null {
  const clean = pin.trim();
  if (!/^\d{2}$/.test(clean)) return null;
  return QUALITY_STAFF.find((s) => s.pin === clean)?.name ?? null;
}

/**
 * The standing check on each of these orders.
 *
 * Also fills in the ready time on checks made while the order was still being
 * washed: CleanCloud only learns it later, and the history should show it.
 * Such a check is never late — it came first.
 */
export async function liveChecks(
  readyTimes: Map<string, Date | null>
): Promise<{ ready: true; marks: Record<string, CheckMark> } | { ready: false; reason: string; marks: Record<string, CheckMark> }> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", marks: {} };
  const ids = [...readyTimes.keys()];
  const marks: Record<string, CheckMark> = {};
  if (ids.length === 0) return { ready: true, marks };

  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db
      .from(CHECKS)
      .select("id, order_id, staff_name, checked_at, ready_at, late")
      .in("order_id", ids.slice(i, i + 300))
      .is("removed_at", null);
    if (error) return { ready: false, reason: isMissingTable(error.code) ? MISSING : error.message, marks };
    rows.push(...((data ?? []) as Row[]));
  }

  const backfill: { id: string; readyAt: string; late: boolean }[] = [];
  for (const r of rows) {
    const orderId = String(r.order_id);
    marks[orderId] = { id: String(r.id), staff: String(r.staff_name), at: String(r.checked_at), late: Boolean(r.late) };
    const cleaned = readyTimes.get(orderId);
    if (!r.ready_at && cleaned) {
      backfill.push({
        id: String(r.id),
        readyAt: cleaned.toISOString(),
        late: Date.parse(String(r.checked_at)) > cleaned.getTime(),
      });
    }
  }
  // Best effort: a failure here only leaves the ready time blank in the history.
  await Promise.all(
    backfill.map((b) => db.from(CHECKS).update({ ready_at: b.readyAt, late: b.late }).eq("id", b.id).is("ready_at", null))
  );
  for (const b of backfill) {
    const orderId = rows.find((r) => String(r.id) === b.id)?.order_id;
    if (orderId) marks[String(orderId)].late = b.late;
  }
  return { ready: true, marks };
}

export type CheckResult =
  | { ok: true; mark: CheckMark }
  | { ok: false; status: number; error: string };

/**
 * Sign an order off with a PIN.
 *
 * The ready time comes from CleanCloud, asked again here rather than taken
 * from the browser, so "late" means what it says. Only the day the order was
 * taken in is read — a single day answers in a moment, where the dashboard's
 * ninety would make somebody stand at the counter waiting.
 */
export async function recordCheck(input: {
  orderId: string;
  takenOn: string | null;
  customerId: string | null;
  customerName: string | null;
  pin: string;
  deviceUser: string;
}): Promise<CheckResult> {
  const staff = staffForPin(input.pin);
  // Nothing is written for a wrong code, not even an attempt.
  if (!staff) return { ok: false, status: 401, error: "Invalid code" };

  const db = client();
  if (!db) return { ok: false, status: 503, error: "Supabase is not configured." };

  let readyAt: Date | null = null;
  if (input.takenOn) {
    try {
      const orders = await fetchOrders(input.takenOn, input.takenOn);
      const order = orders.find((o) => o.id === input.orderId);
      if (order && order.status !== STATUS.RECEIVED) readyAt = order.cleanedAt;
    } catch {
      // CleanCloud slow or down: the check still counts, and the ready time is filled in later.
    }
  }
  const now = new Date();

  const { data, error } = await db
    .from(CHECKS)
    .insert({
      order_id: input.orderId,
      customer_id: input.customerId,
      customer_name: input.customerName,
      staff_name: staff,
      checked_at: now.toISOString(),
      ready_at: readyAt?.toISOString() ?? null,
      late: !!readyAt && now.getTime() > readyAt.getTime(),
      device_user: input.deviceUser,
    })
    .select("id, staff_name, checked_at, late")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await db
        .from(CHECKS)
        .select("staff_name")
        .eq("order_id", input.orderId)
        .is("removed_at", null)
        .maybeSingle();
      return { ok: false, status: 409, error: `Already checked by ${existing?.staff_name ?? "someone else"}.` };
    }
    return { ok: false, status: 500, error: isMissingTable(error.code) ? MISSING : error.message };
  }
  return {
    ok: true,
    mark: { id: String(data.id), staff: String(data.staff_name), at: String(data.checked_at), late: Boolean(data.late) },
  };
}

/**
 * The owner putting right a check given to the wrong person.
 *
 * Either it moves to the person who actually did it, or it is withdrawn and
 * the order counts as unchecked again. The record itself is kept either way,
 * and what was changed, by whom and why is written beside it.
 */
export async function correctCheck(input: {
  checkId: string;
  action: "reassign" | "remove";
  toStaff: string | null;
  reason: string | null;
  by: string;
}): Promise<{ ok: true; mark: CheckMark | null } | { ok: false; status: number; error: string }> {
  const db = client();
  if (!db) return { ok: false, status: 503, error: "Supabase is not configured." };

  const { data: row, error } = await db.from(CHECKS).select("*").eq("id", input.checkId).maybeSingle();
  if (error) return { ok: false, status: 500, error: isMissingTable(error.code) ? MISSING : error.message };
  if (!row || row.removed_at) return { ok: false, status: 404, error: "That check is no longer standing." };

  if (input.action === "reassign") {
    if (!input.toStaff || !qualityStaffNames().includes(input.toStaff)) {
      return { ok: false, status: 400, error: "Choose who actually checked it." };
    }
    if (input.toStaff === row.staff_name) return { ok: false, status: 400, error: "It is already theirs." };
  }

  const log = await db.from(CORRECTIONS).insert({
    check_id: input.checkId,
    action: input.action,
    from_staff: row.staff_name,
    to_staff: input.action === "reassign" ? input.toStaff : null,
    reason: input.reason,
    made_by: input.by,
  });
  // The correction is written first: a change nobody can trace is worse than one not made.
  if (log.error) return { ok: false, status: 500, error: log.error.message };

  const patch =
    input.action === "reassign"
      ? { staff_name: input.toStaff }
      : { removed_at: new Date().toISOString(), removed_by: input.by };
  const upd = await db.from(CHECKS).update(patch).eq("id", input.checkId);
  if (upd.error) return { ok: false, status: 500, error: upd.error.message };

  return {
    ok: true,
    mark:
      input.action === "reassign"
        ? { id: String(row.id), staff: input.toStaff!, at: String(row.checked_at), late: Boolean(row.late) }
        : null,
  };
}

export type HistoryFilter = { order?: string; staff?: string; from?: string; to?: string };

/** Oman keeps one clock all year, so a shop day is always these 24 hours. */
const dayStart = (d: string) => `${d}T00:00:00+04:00`;
const dayEnd = (d: string) => `${d}T23:59:59.999+04:00`;

/**
 * Checks matching the filter, newest first, with their corrections.
 * Withdrawn checks are included so the history is whole; totals leave them out.
 */
export async function checkHistory(
  f: HistoryFilter
): Promise<{ ready: true; checks: Check[]; capped: boolean } | { ready: false; reason: string; checks: Check[]; capped: boolean }> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", checks: [], capped: false };
  const LIMIT = 5000;

  const rows: Row[] = [];
  for (let from = 0; from < LIMIT; from += 1000) {
    let q = db.from(CHECKS).select("*").order("checked_at", { ascending: false }).order("id");
    if (f.order) q = q.eq("order_id", f.order);
    if (f.staff) q = q.eq("staff_name", f.staff);
    if (f.from) q = q.gte("checked_at", dayStart(f.from));
    if (f.to) q = q.lte("checked_at", dayEnd(f.to));
    const { data, error } = await q.range(from, from + 999);
    if (error) {
      return { ready: false, reason: isMissingTable(error.code) ? MISSING : error.message, checks: [], capped: false };
    }
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  const byCheck = new Map<string, Correction[]>();
  const ids = rows.map((r) => String(r.id));
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db
      .from(CORRECTIONS)
      .select("*")
      .in("check_id", ids.slice(i, i + 300))
      .order("made_at");
    for (const c of (data ?? []) as Row[]) {
      const list = byCheck.get(String(c.check_id)) ?? [];
      list.push({
        action: c.action === "remove" ? "remove" : "reassign",
        fromStaff: str(c.from_staff),
        toStaff: str(c.to_staff),
        reason: str(c.reason),
        madeBy: String(c.made_by),
        madeAt: String(c.made_at),
      });
      byCheck.set(String(c.check_id), list);
    }
  }

  return {
    ready: true,
    checks: rows.map((r) => toCheck(r, byCheck.get(String(r.id)) ?? [])),
    capped: rows.length >= LIMIT,
  };
}
