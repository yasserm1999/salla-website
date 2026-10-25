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

/** A change somebody has asked for, waiting on an owner. */
export type PendingChange = {
  id: string;
  action: "reassign" | "remove";
  toStaff: string | null;
  reason: string | null;
  requestedBy: string;
  requestedAt: string;
};

/** What a circle on the board needs to draw itself. */
export type CheckMark = { id: string; staff: string; at: string; late: boolean; pending: PendingChange | null };

const REQUESTS = "salla_quality_requests";
const MISSING_REQUESTS = `The ${REQUESTS} table does not exist yet — run the end of supabase/quality-checks.sql.`;

const toPending = (r: Row): PendingChange => ({
  id: String(r.id),
  action: r.action === "remove" ? "remove" : "reassign",
  toStaff: str(r.to_staff),
  reason: str(r.reason),
  requestedBy: String(r.requested_by),
  requestedAt: String(r.requested_at),
});

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

/** What each person's circle says: their own short label, or the first three letters. */
export const qualityShortNames = (): Record<string, string> =>
  Object.fromEntries(
    QUALITY_STAFF.map((s) => [s.name, (s.short ?? s.name.slice(0, 3)).toUpperCase().slice(0, 3)])
  );

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
    marks[orderId] = {
      id: String(r.id),
      staff: String(r.staff_name),
      at: String(r.checked_at),
      late: Boolean(r.late),
      pending: null,
    };
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

  // Changes asked for and not yet decided. Without the table, there simply are none.
  const checkIds = rows.map((r) => String(r.id));
  const orderOf = new Map(rows.map((r) => [String(r.id), String(r.order_id)]));
  for (let i = 0; i < checkIds.length; i += 300) {
    const { data } = await db
      .from(REQUESTS)
      .select("*")
      .in("check_id", checkIds.slice(i, i + 300))
      .eq("status", "pending");
    for (const r of (data ?? []) as Row[]) {
      const orderId = orderOf.get(String(r.check_id));
      if (orderId && marks[orderId]) marks[orderId].pending = toPending(r);
    }
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
    mark: {
      id: String(data.id),
      staff: String(data.staff_name),
      at: String(data.checked_at),
      late: Boolean(data.late),
      pending: null,
    },
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
  /** Close any request still open on this check. Off when the request itself is being applied. */
  closeRequests?: boolean;
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

  // Whatever was still being asked about this check has now been answered.
  if (input.closeRequests !== false) {
    await db
      .from(REQUESTS)
      .update({ status: "closed", decided_by: input.by, decided_at: new Date().toISOString() })
      .eq("check_id", input.checkId)
      .eq("status", "pending");
  }

  return {
    ok: true,
    mark:
      input.action === "reassign"
        ? { id: String(row.id), staff: input.toStaff!, at: String(row.checked_at), late: Boolean(row.late), pending: null }
        : null,
  };
}

/**
 * A member of staff saying a check is wrong.
 *
 * Their own code is asked for, so the owner knows who is asking — the login
 * on a shared tablet says nothing about that. Nothing changes until an owner
 * says yes.
 */
export async function requestChange(input: {
  checkId: string;
  action: "reassign" | "remove";
  toStaff: string | null;
  reason: string | null;
  pin: string;
}): Promise<{ ok: true; pending: PendingChange } | { ok: false; status: number; error: string }> {
  const asker = staffForPin(input.pin);
  if (!asker) return { ok: false, status: 401, error: "Invalid code" };
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

  const { data, error: e } = await db
    .from(REQUESTS)
    .insert({
      check_id: input.checkId,
      order_id: row.order_id,
      action: input.action,
      to_staff: input.action === "reassign" ? input.toStaff : null,
      reason: input.reason,
      requested_by: asker,
    })
    .select("*")
    .single();
  if (e) {
    if (e.code === "23505") return { ok: false, status: 409, error: "A change is already waiting for approval." };
    return { ok: false, status: 500, error: isMissingTable(e.code) ? MISSING_REQUESTS : e.message };
  }
  return { ok: true, pending: toPending(data as Row) };
}

/** An owner's yes or no. A yes is made and logged as a correction, naming who asked. */
export async function decideRequest(input: {
  requestId: string;
  approve: boolean;
  by: string;
}): Promise<{ ok: true; mark: CheckMark | null; orderId: string } | { ok: false; status: number; error: string }> {
  const db = client();
  if (!db) return { ok: false, status: 503, error: "Supabase is not configured." };

  const { data: req, error } = await db.from(REQUESTS).select("*").eq("id", input.requestId).maybeSingle();
  if (error) return { ok: false, status: 500, error: isMissingTable(error.code) ? MISSING_REQUESTS : error.message };
  if (!req || req.status !== "pending") return { ok: false, status: 404, error: "That request has already been answered." };

  // Claimed first, so two owners pressing at once cannot both apply it.
  const claim = await db
    .from(REQUESTS)
    .update({ status: input.approve ? "approved" : "rejected", decided_by: input.by, decided_at: new Date().toISOString() })
    .eq("id", input.requestId)
    .eq("status", "pending")
    .select("id");
  if (claim.error) return { ok: false, status: 500, error: claim.error.message };
  if (!claim.data?.length) return { ok: false, status: 409, error: "That request has already been answered." };

  const { data: check } = await db.from(CHECKS).select("*").eq("id", req.check_id).maybeSingle();
  const unchanged: CheckMark | null =
    check && !check.removed_at
      ? { id: String(check.id), staff: String(check.staff_name), at: String(check.checked_at), late: Boolean(check.late), pending: null }
      : null;
  if (!input.approve) return { ok: true, mark: unchanged, orderId: String(req.order_id) };

  const asked = `Asked by ${req.requested_by}${req.reason ? `: ${req.reason}` : ""}`;
  const res = await correctCheck({
    checkId: String(req.check_id),
    action: req.action === "remove" ? "remove" : "reassign",
    toStaff: str(req.to_staff),
    reason: asked,
    by: input.by,
    closeRequests: false,
  });
  if (!res.ok) {
    // Put the request back, so it can be answered again once the problem is fixed.
    await db.from(REQUESTS).update({ status: "pending", decided_by: null, decided_at: null }).eq("id", input.requestId);
    return res;
  }
  return { ok: true, mark: res.mark, orderId: String(req.order_id) };
}

export type OpenRequest = PendingChange & {
  orderId: string;
  checkId: string;
  currentStaff: string;
  customerName: string | null;
  checkedAt: string;
};

/** Everything waiting on an owner, oldest first. */
export async function openRequests(): Promise<
  { ready: true; requests: OpenRequest[] } | { ready: false; reason: string; requests: OpenRequest[] }
> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", requests: [] };
  const { data, error } = await db
    .from(REQUESTS)
    .select("*")
    .eq("status", "pending")
    .order("requested_at")
    .limit(200);
  if (error) {
    return { ready: false, reason: isMissingTable(error.code) ? MISSING_REQUESTS : error.message, requests: [] };
  }
  const rows = (data ?? []) as Row[];
  if (!rows.length) return { ready: true, requests: [] };
  const { data: checks } = await db
    .from(CHECKS)
    .select("id, staff_name, customer_name, checked_at")
    .in("id", rows.map((r) => String(r.check_id)));
  const byId = new Map(((checks ?? []) as Row[]).map((c) => [String(c.id), c]));
  return {
    ready: true,
    requests: rows.map((r) => {
      const c = byId.get(String(r.check_id));
      return {
        ...toPending(r),
        orderId: String(r.order_id),
        checkId: String(r.check_id),
        currentStaff: c ? String(c.staff_name) : "—",
        customerName: c ? str(c.customer_name) : null,
        checkedAt: c ? String(c.checked_at) : String(r.requested_at),
      };
    }),
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

/** One line of an answer to "who checked this?". */
export type Found = {
  id: string;
  orderId: string;
  customerId: string | null;
  customerName: string | null;
  staff: string;
  checkedAt: string;
  late: boolean;
};

/**
 * Who checked it — found by order number, customer number or part of the
 * customer's name. Only standing checks: a withdrawn one was never anybody's.
 */
export async function findChecks(
  query: string
): Promise<{ ready: true; found: Found[] } | { ready: false; reason: string; found: Found[] }> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", found: [] };
  // Commas and brackets mean something to the filter syntax; nobody's name needs them.
  const q = query.trim().replace(/^#/, "").replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
  if (!q) return { ready: true, found: [] };

  const tests = [`customer_name.ilike.*${q}*`];
  if (/^\d+$/.test(q)) tests.push(`order_id.eq.${q}`, `customer_id.eq.${q}`);
  const { data, error } = await db
    .from(CHECKS)
    .select("id, order_id, customer_id, customer_name, staff_name, checked_at, late")
    .is("removed_at", null)
    .or(tests.join(","))
    .order("checked_at", { ascending: false })
    .limit(100);
  if (error) return { ready: false, reason: isMissingTable(error.code) ? MISSING : error.message, found: [] };
  return {
    ready: true,
    found: ((data ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      orderId: String(r.order_id),
      customerId: str(r.customer_id),
      customerName: str(r.customer_name),
      staff: String(r.staff_name),
      checkedAt: String(r.checked_at),
      late: Boolean(r.late),
    })),
  };
}

/** Every standing check ever, counted per person. */
export async function staffTotals(): Promise<
  { ready: true; totals: Map<string, { count: number; late: number }> } | { ready: false; reason: string; totals: Map<string, { count: number; late: number }> }
> {
  const totals = new Map<string, { count: number; late: number }>();
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", totals };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(CHECKS)
      .select("id, staff_name, late")
      .is("removed_at", null)
      .order("id")
      .range(from, from + 999);
    if (error) return { ready: false, reason: isMissingTable(error.code) ? MISSING : error.message, totals };
    for (const r of (data ?? []) as Row[]) {
      const t = totals.get(String(r.staff_name)) ?? { count: 0, late: 0 };
      t.count++;
      if (r.late) t.late++;
      totals.set(String(r.staff_name), t);
    }
    if (!data || data.length < 1000) break;
  }
  return { ready: true, totals };
}
