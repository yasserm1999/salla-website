import "server-only";

/**
 * Reading the shop out of CleanCloud.
 *
 * Three things about this API decide the shape of everything below:
 *
 *   1. Every date comes back as a Unix timestamp inside a string —
 *      "1787473850", not "2026-08-26". Comparing those as text says every
 *      order is late, which is both wrong and the most alarming way to be
 *      wrong.
 *
 *   2. `status` is the truth about where an order is. `completedDate` is only
 *      filled in once it is collected, so testing that field marks everything
 *      still in the shop as finished.
 *
 *   3. `deliveryDate` carries the day and `deliveryTime` carries the hour, as
 *      a human string — "5pm", "7pm-8pm". The hour is not in the timestamp.
 */

const API = "https://cleancloudapp.com/api";

/** What CleanCloud's status column means for a laundry. */
export const STATUS = {
  RECEIVED: "0",
  CLEANED: "1",
  COLLECTED: "2",
} as const;

export type Order = {
  id: string;
  customerID: string;
  total: number;
  paid: boolean;
  pieces: number;
  /** 0 received · 1 cleaned, on the rack · 2 collected */
  status: string;
  createdAt: Date | null;
  cleanedAt: Date | null;
  collectedAt: Date | null;
  /** The day it was promised back. The hour lives in dueTimeLabel. */
  dueAt: Date | null;
  /** As the shop writes it: "5pm", "7pm-8pm". */
  dueTimeLabel: string | null;
  rack: string | null;
  notes: string | null;
  summary: string | null;
};

function at(value: unknown): Date | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
}

/**
 * "5pm" → 17:00. "7pm-8pm" → the start, 19:00. Used only for putting the day
 * in order, never for deciding whether something is late — a promise made for
 * "5pm" is not broken at 5:01.
 */
export function dueMinutes(label: string | null): number | null {
  if (!label) return null;
  const m = label.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let hour = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  const meridiem = m[3];
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + mins;
}

function toOrder(raw: Record<string, unknown>): Order {
  const s = (k: string) => (raw[k] == null ? null : String(raw[k]));
  const time = s("deliveryTime");
  return {
    id: String(raw.id ?? ""),
    customerID: String(raw.customerID ?? ""),
    total: Number(raw.total ?? 0),
    paid: raw.paid === "1" || raw.paid === 1 || raw.paid === true,
    pieces: Number(raw.pieces ?? 0),
    status: String(raw.status ?? ""),
    createdAt: at(raw.createdDate),
    cleanedAt: at(raw.cleanedDate),
    collectedAt: at(raw.completedDate),
    dueAt: at(raw.deliveryDate),
    dueTimeLabel: time && time !== "0" && time !== "0-0" ? time : null,
    rack: s("rack") && s("rack") !== "0" ? s("rack") : null,
    notes: s("notes") || null,
    summary: s("summary") || null,
  };
}

export class CleanCloudError extends Error {}

async function post(endpoint: string, body: Record<string, unknown>) {
  const token = process.env.CLEANCLOUD_API_KEY;
  if (!token) throw new CleanCloudError("CLEANCLOUD_API_KEY is not set.");

  let lastError = "";
  // The host drops a connection now and then; one timeout is not an answer.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: token, ...body }),
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.Error) throw new CleanCloudError(String(data.Error));
      return data;
    } catch (e) {
      if (e instanceof CleanCloudError) throw e;
      lastError = e instanceof Error ? e.message : String(e);
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw new CleanCloudError(`CleanCloud did not answer: ${lastError}`);
}

/**
 * Every order between two days.
 *
 * The undocumented part: `getOrders` refuses a bare call and asks for a
 * "Filter" that does not appear to exist. A date range does, and is the only
 * way to see the whole shop rather than one customer at a time.
 */
export async function fetchOrders(dateFrom: string, dateTo: string): Promise<Order[]> {
  const data = await post("getOrders", { dateFrom, dateTo });
  return (Array.isArray(data?.Orders) ? data.Orders : []).map(toOrder);
}

/**
 * Names for the orders being shown.
 *
 * There is no list endpoint, so this is one call per customer — fetched only
 * for the handful on screen, a few at a time so a slow shop day does not turn
 * into fifty simultaneous requests.
 */
export async function fetchCustomerNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];

  const BATCH = 5;
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (id) => {
        try {
          const c = await post("getCustomer", { customerID: id });
          const name = c?.Name ?? c?.Customer?.Name;
          return [id, typeof name === "string" && name.trim() ? name.trim() : null] as const;
        } catch {
          // A missing name must never take the board down with it.
          return [id, null] as const;
        }
      })
    );
    for (const [id, name] of results) if (name) names.set(id, name);
  }
  return names;
}

// ── Sorting the shop by what it owes ───────────────────────────────────

export type Urgency = "late" | "today" | "soon" | "later" | "ready" | "collected";

export type Assessed = Order & {
  urgency: Urgency;
  /** Negative when past the promised day, 0 today, positive when ahead. */
  daysUntilDue: number | null;
  /** Days finished and waiting for someone to come. */
  daysOnRack: number | null;
  cleaned: boolean;
  customerName: string | null;
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * How much attention an order deserves.
 *
 * The shop's promise is to have the washing done. Once it is done the promise
 * is kept — a clean bag waiting on the rack is the customer's errand, not the
 * shop's failure, however long it sits there.
 *
 * So lateness is measured only against work still owed: an order past its day
 * that has not been cleaned is late, and one that has been cleaned is simply
 * ready. That is why the two lists look so different in size.
 */
export function assess(order: Order, now = new Date()): Assessed {
  const today = startOfDay(now);
  const cleaned = order.status !== STATUS.RECEIVED;

  const daysUntilDue = order.dueAt ? Math.round((startOfDay(order.dueAt) - today) / DAY) : null;
  const daysOnRack =
    order.status === STATUS.CLEANED && order.cleanedAt
      ? Math.floor((today - startOfDay(order.cleanedAt)) / DAY)
      : null;

  let urgency: Urgency;
  if (order.status === STATUS.COLLECTED) {
    urgency = "collected";
  } else if (order.status === STATUS.CLEANED) {
    // Washed and folded. Nothing is owed but the customer's own trip.
    urgency = "ready";
  } else if (daysUntilDue === null) {
    urgency = "later";
  } else if (daysUntilDue < 0) {
    urgency = "late";
  } else if (daysUntilDue === 0) {
    urgency = "today";
  } else if (daysUntilDue <= 2) {
    urgency = "soon";
  } else {
    urgency = "later";
  }

  return { ...order, urgency, daysUntilDue, daysOnRack, cleaned, customerName: null };
}

/** Worst first, and within a day, earliest promise first. */
function byUrgencyThenTime(a: Assessed, b: Assessed): number {
  const byDay = (a.daysUntilDue ?? 9999) - (b.daysUntilDue ?? 9999);
  if (byDay !== 0) return byDay;
  const at = dueMinutes(a.dueTimeLabel);
  const bt = dueMinutes(b.dueTimeLabel);
  if (at !== null && bt !== null && at !== bt) return at - bt;
  if (at !== null && bt === null) return -1;
  if (at === null && bt !== null) return 1;
  return b.total - a.total;
}

export const URGENCY_ORDER: Urgency[] = ["late", "today", "soon", "later", "ready", "collected"];

export type Board = {
  generatedAt: string;
  windowFrom: string;
  windowTo: string;
  groups: Record<Urgency, Assessed[]>;
  totals: {
    owed: number;
    late: number;
    dueToday: number;
    dueSoon: number;
    ready: number;
    readyOverWeek: number;
    valueLate: number;
    valueReady: number;
    worstDaysLate: number;
    unpaidReady: number;
  };
};

export function buildBoard(orders: Order[], now = new Date()): Board {
  const assessed = orders.map((o) => assess(o, now));

  const groups = Object.fromEntries(
    URGENCY_ORDER.map((u) => [u, [] as Assessed[]])
  ) as Record<Urgency, Assessed[]>;
  for (const o of assessed) groups[o.urgency].push(o);

  for (const u of URGENCY_ORDER) groups[u].sort(byUrgencyThenTime);
  // The rack is read oldest-first: those are the ones to ring about.
  groups.ready.sort((a, b) => (b.daysOnRack ?? 0) - (a.daysOnRack ?? 0));

  const owed = groups.late.length + groups.today.length + groups.soon.length + groups.later.length;

  return {
    generatedAt: now.toISOString(),
    windowFrom: "",
    windowTo: "",
    groups,
    totals: {
      owed,
      late: groups.late.length,
      dueToday: groups.today.length,
      dueSoon: groups.soon.length,
      ready: groups.ready.length,
      readyOverWeek: groups.ready.filter((o) => (o.daysOnRack ?? 0) >= 7).length,
      valueLate: groups.late.reduce((s, o) => s + o.total, 0),
      valueReady: groups.ready.reduce((s, o) => s + o.total, 0),
      worstDaysLate: groups.late.length ? Math.abs(groups.late[0].daysUntilDue ?? 0) : 0,
      unpaidReady: groups.ready.filter((o) => !o.paid).length,
    },
  };
}

/** Today and the ninety days behind it, which is where anything open lives. */
export function defaultWindow(now = new Date()): { from: string; to: string } {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return { from: ymd(new Date(now.getTime() - 90 * DAY)), to: ymd(now) };
}
