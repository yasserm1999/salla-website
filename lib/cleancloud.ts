import "server-only";

/**
 * Reading the shop out of CleanCloud.
 *
 * Two things about this API decide the whole shape of the code below:
 *
 *   1. Every date comes back as a Unix timestamp inside a string — "1787473850",
 *      not "2026-08-26". Comparing those as text says every order is late,
 *      which is both wrong and the most alarming way to be wrong.
 *
 *   2. `status` is the truth about where an order is. `completedDate` is only
 *      filled in once it is collected, so testing that field marks everything
 *      still in the shop as finished.
 */

const API = "https://cleancloudapp.com/api";

/** What CleanCloud's status column means for a laundry. */
export const STATUS = {
  RECEIVED: "0",
  CLEANED: "1",
  COLLECTED: "2",
} as const;

export type RawOrder = Record<string, unknown>;

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
  /** When it was promised back to the customer. */
  dueAt: Date | null;
  rack: string | null;
  notes: string | null;
  summary: string | null;
};

/** "1787473850" → Date. "0", "" and nonsense → null. */
function at(value: unknown): Date | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
}

function toOrder(raw: RawOrder): Order {
  const s = (k: string) => (raw[k] == null ? null : String(raw[k]));
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
    rack: s("rack") && s("rack") !== "0" ? s("rack") : null,
    notes: s("notes") || null,
    summary: s("summary") || null,
  };
}

export class CleanCloudError extends Error {}

/**
 * Every order between two days.
 *
 * The undocumented part: `getOrders` refuses a bare call, and the "Filter"
 * it asks for in the error message does not appear to exist. A date range
 * does, and is the only way to see the whole shop rather than one customer.
 */
export async function fetchOrders(dateFrom: string, dateTo: string): Promise<Order[]> {
  const token = process.env.CLEANCLOUD_API_KEY;
  if (!token) throw new CleanCloudError("CLEANCLOUD_API_KEY is not set.");

  let lastError = "";
  // The host drops a connection now and then; one timeout is not an answer.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}/getOrders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_token: token, dateFrom, dateTo }),
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.Error) throw new CleanCloudError(String(data.Error));
      const list = Array.isArray(data?.Orders) ? data.Orders : [];
      return list.map(toOrder);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (e instanceof CleanCloudError) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new CleanCloudError(`CleanCloud did not answer: ${lastError}`);
}

// ── Sorting the shop by what actually matters ──────────────────────────

export type Urgency = "overdue" | "today" | "soon" | "later" | "resting" | "collected";

export type Assessed = Order & {
  urgency: Urgency;
  /** Negative when late, 0 today, positive when still ahead. */
  daysUntilDue: number | null;
  /** How long it has been finished and waiting, in days. */
  daysOnRack: number | null;
  cleaned: boolean;
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * How much attention an order deserves.
 *
 * Being late is the worst thing that can happen, and being about to be late is
 * the second. A clean bag nobody has collected is money sitting still — worth
 * chasing, but it is not a promise being broken, so it never outranks a
 * deadline.
 */
export function assess(order: Order, now = new Date()): Assessed {
  const today = startOfDay(now);
  const cleaned = order.status === STATUS.CLEANED;

  const daysUntilDue = order.dueAt
    ? Math.round((startOfDay(order.dueAt) - today) / DAY)
    : null;

  const daysOnRack = cleaned && order.cleanedAt
    ? Math.floor((today - startOfDay(order.cleanedAt)) / DAY)
    : null;

  let urgency: Urgency;
  if (order.status === STATUS.COLLECTED) {
    urgency = "collected";
  } else if (daysUntilDue === null) {
    // No promise made. It cannot be late, so it waits with the rest.
    urgency = daysOnRack !== null && daysOnRack >= 7 ? "resting" : "later";
  } else if (daysUntilDue < 0) {
    urgency = "overdue";
  } else if (daysUntilDue === 0) {
    urgency = "today";
  } else if (daysUntilDue <= 2) {
    urgency = "soon";
  } else {
    urgency = "later";
  }

  /*
    A bag that has sat a week is worth chasing, but only once its own deadline
    is comfortably ahead — otherwise the deadline is the story, not the dust.
  */
  if (urgency === "later" && daysOnRack !== null && daysOnRack >= 7) {
    urgency = "resting";
  }

  return { ...order, urgency, daysUntilDue, daysOnRack, cleaned };
}

export const URGENCY_ORDER: Urgency[] = ["overdue", "today", "soon", "later", "resting", "collected"];

export type Board = {
  generatedAt: string;
  windowFrom: string;
  windowTo: string;
  groups: Record<Urgency, Assessed[]>;
  totals: {
    pending: number;
    overdue: number;
    dueToday: number;
    dueSoon: number;
    onRackOverWeek: number;
    finishedUnpaid: number;
    valueOverdue: number;
    valueOnRack: number;
    notCleanedYet: number;
    worstDaysLate: number;
  };
};

/** Everything the dashboard shows, worked out once. */
export function buildBoard(orders: Order[], now = new Date()): Board {
  const assessed = orders.map((o) => assess(o, now));

  const groups = Object.fromEntries(
    URGENCY_ORDER.map((u) => [u, [] as Assessed[]])
  ) as Record<Urgency, Assessed[]>;
  for (const o of assessed) groups[o.urgency].push(o);

  // Worst first inside every group: most overdue, then largest.
  for (const u of URGENCY_ORDER) {
    groups[u].sort((a, b) => {
      const byDue = (a.daysUntilDue ?? 9999) - (b.daysUntilDue ?? 9999);
      if (byDue !== 0) return byDue;
      return b.total - a.total;
    });
  }

  const pending = assessed.filter((o) => o.status !== STATUS.COLLECTED);
  const overdue = groups.overdue;
  const onRack = pending.filter((o) => (o.daysOnRack ?? 0) >= 7);

  return {
    generatedAt: now.toISOString(),
    windowFrom: "",
    windowTo: "",
    groups,
    totals: {
      pending: pending.length,
      overdue: overdue.length,
      dueToday: groups.today.length,
      dueSoon: groups.soon.length,
      onRackOverWeek: onRack.length,
      finishedUnpaid: assessed.filter((o) => o.status === STATUS.COLLECTED && !o.paid).length,
      valueOverdue: overdue.reduce((s, o) => s + o.total, 0),
      valueOnRack: pending.reduce((s, o) => s + o.total, 0),
      notCleanedYet: pending.filter((o) => o.status === STATUS.RECEIVED).length,
      worstDaysLate: overdue.length ? Math.abs(overdue[0].daysUntilDue ?? 0) : 0,
    },
  };
}

/** Today and the ninety days behind it, which is where anything open lives. */
export function defaultWindow(now = new Date()): { from: string; to: string } {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return { from: ymd(new Date(now.getTime() - 90 * DAY)), to: ymd(now) };
}
