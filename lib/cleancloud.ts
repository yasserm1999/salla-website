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
  /** True when the shop drives it to them rather than the customer coming. */
  isDelivery: boolean;
  /** CleanCloud's own receipt, which lists every line. */
  receiptUrl: string | null;
  tax: number;
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

/** "Dishdasha x 7<br>Shirt x 1" → "Dishdasha x 7 · Shirt x 1". */
function tidy(value: string | null): string | null {
  if (!value) return null;
  const text = value
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/**
 * When a promise actually falls due.
 *
 * "5pm" is 17:00. "7pm-8pm" is 20:00 — a window is not broken until it has
 * closed, so the end of it is the deadline. Used to decide lateness within
 * today, which day-level arithmetic cannot see: at 11:43, an order promised
 * for 11am is late, and calling it "due today" hides the one thing worth
 * knowing about it.
 */
export function dueWindowEnd(label: string | null): number | null {
  if (!label) return null;
  const parts = label.split(/[-–]/);
  return dueMinutes(parts.length > 1 ? parts[parts.length - 1] : parts[0]);
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
    notes: tidy(s("notes")),
    // CleanCloud writes the item list with HTML line breaks in it.
    summary: tidy(s("summary")),
    isDelivery: String(raw.delivery) === "1",
    receiptUrl: s("receiptLink") ? `https://cleancloudapp.com/${s("receiptLink")}` : null,
    tax: Number(raw.tax1 ?? 0) + Number(raw.tax2 ?? 0) + Number(raw.tax3 ?? 0),
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
export type CustomerBrief = { name: string | null; tel: string | null; place: string | null };

/**
 * Customer records, remembered.
 *
 * CleanCloud rate-limits this endpoint hard. Asked five at a time, thirty-one
 * of forty come back as errors — which is why most of the board read
 * "Customer 1" instead of a name. Asked one at a time with a breath between,
 * all forty answer, but twenty names then take ten seconds, and no dashboard
 * should keep anyone waiting that long.
 *
 * So they are cached. A name and a phone number do not change between
 * lunchtime and closing, and the cache lives as long as the server instance —
 * the first load of the day pays for the lookups and every one after is free.
 */
const customerCache = new Map<string, { brief: CustomerBrief; at: number }>();
const CACHE_TTL = 12 * 60 * 60 * 1000;

/**
 * One customer, insisting politely.
 *
 * A refusal here is almost always the rate limiter rather than a missing
 * customer — the same id asked again a moment later answers. The generic
 * caller treats any Error as final, which is right for a bad request and
 * wrong for this, so this one waits and asks again.
 */
async function lookupCustomer(id: string): Promise<Record<string, unknown>> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await post("getCustomer", { customerID: id });
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw last;
}

/** Enough to fill the screen without making anyone wait for it. */
const LOOKUP_BUDGET = 40;
const LOOKUP_GAP_MS = 110;

export async function fetchCustomers(ids: string[]): Promise<Map<string, CustomerBrief>> {
  const found = new Map<string, CustomerBrief>();
  const now = Date.now();
  const wanted: string[] = [];

  // Anything already known is free and does not count against the budget.
  for (const id of ids) {
    if (!id || found.has(id)) continue;
    const hit = customerCache.get(id);
    if (hit && now - hit.at < CACHE_TTL) found.set(id, hit.brief);
    else if (!wanted.includes(id)) wanted.push(id);
  }

  /*
    The budget is a promise about how long this page takes, not about how much
    we would like to know. Whatever is left over shows as the customer number
    and fills itself in on the next refresh — a better failure than a
    dashboard that hangs.
  */
  for (const id of wanted.slice(0, LOOKUP_BUDGET)) {
    try {
      const c = await lookupCustomer(id);
      const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      const brief: CustomerBrief = {
        name: text(c?.Name),
        tel: text(c?.Tel),
        place: text(c?.addressDetailed) ?? text(c?.Address) ?? null,
      };
      if (brief.name || brief.tel) {
        customerCache.set(id, { brief, at: now });
        found.set(id, brief);
      }
    } catch {
      // One missing customer must never take the board down with it.
    }
    await new Promise((r) => setTimeout(r, LOOKUP_GAP_MS));
  }

  return found;
}

// ── Sorting the shop by what it owes ───────────────────────────────────

export type Urgency =
  | "late"
  | "today"
  | "tomorrow"
  | "inTwo"
  | "later"
  | "ready"
  | "collected";

export type Assessed = Order & {
  urgency: Urgency;
  /** Negative when past the promised day, 0 today, positive when ahead. */
  daysUntilDue: number | null;
  /** Days finished and waiting for someone to come. */
  daysOnRack: number | null;
  cleaned: boolean;
  customerName: string | null;
  customerTel: string | null;
  customerPlace: string | null;
};

const DAY = 86_400_000;

/**
 * The shop's own calendar.
 *
 * Oman runs four hours ahead of UTC, so from 8pm onwards the two disagree
 * about what day it is — and 8pm onwards is exactly when a laundry promising
 * "5pm" and "10pm" needs the answer. Doing this arithmetic in UTC put
 * tomorrow's work under "next two days" for the whole evening, every evening.
 *
 * Oman keeps no daylight saving, but this asks the timezone database rather
 * than hard-coding four hours, so it stays right if that ever changes.
 */
const SHOP_TZ = "Asia/Muscat";

const shopDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The civil date in the shop, as YYYY-MM-DD. */
export function shopYmd(d: Date): string {
  return shopDateFormat.format(d);
}

/** The time of day in the shop, in minutes since midnight. */
function shopMinutesNow(now: Date): number {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Midnight in the shop, as a number that can be subtracted. */
const startOfDay = (d: Date) => Date.parse(`${shopYmd(d)}T00:00:00Z`);

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
    /*
      Washed and folded. Nothing is owed but the customer's own trip — unless
      it is on the pending-payment rack, in which case it has already gone to
      them and is not on any rack at all. Counting those as waiting made the
      rack look fuller than the shop is.
    */
    urgency = order.rack === PENDING_PAYMENT_RACK ? "collected" : "ready";
  } else if (daysUntilDue === null) {
    urgency = "later";
  } else if (daysUntilDue < 0) {
    urgency = "late";
  } else if (daysUntilDue === 0) {
    /*
      Today is not one thing. An order promised for 11am is late at 11:43 and
      perfectly fine at 09:00, and the difference is the whole point of the
      band. A window like "7pm-8pm" is judged on its end: it is not broken
      until it has closed.
    */
    const deadline = dueWindowEnd(order.dueTimeLabel);
    urgency = deadline !== null && shopMinutesNow(now) > deadline ? "late" : "today";
  } else if (daysUntilDue === 1) {
    urgency = "tomorrow";
  } else if (daysUntilDue === 2) {
    urgency = "inTwo";
  } else {
    // Everything further out is one heap; nothing about it changes today.
    urgency = "later";
  }

  return {
    ...order,
    urgency,
    daysUntilDue,
    daysOnRack,
    cleaned,
    customerName: null,
    customerTel: null,
    customerPlace: null,
  };
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

export const URGENCY_ORDER: Urgency[] = [
  "late",
  "today",
  "tomorrow",
  "inTwo",
  "later",
  "ready",
  "collected",
];

export type Board = {
  generatedAt: string;
  windowFrom: string;
  windowTo: string;
  groups: Record<Urgency, Assessed[]>;
  totals: {
    owed: number;
    late: number;
    dueToday: number;
    dueTomorrow: number;
    dueInTwo: number;
    dueLater: number;
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

  const owed =
    groups.late.length +
    groups.today.length +
    groups.tomorrow.length +
    groups.inTwo.length +
    groups.later.length;

  return {
    generatedAt: now.toISOString(),
    windowFrom: "",
    windowTo: "",
    groups,
    totals: {
      owed,
      late: groups.late.length,
      dueToday: groups.today.length,
      dueTomorrow: groups.tomorrow.length,
      dueInTwo: groups.inTwo.length,
      dueLater: groups.later.length,
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
  /*
    Asked for in the shop's dates. In UTC the window ends yesterday all
    evening, which quietly hides orders taken in after 8pm — the busiest
    hours of the day.
  */
  return { from: shopYmd(new Date(now.getTime() - 90 * DAY)), to: shopYmd(now) };
}

// ── The driver's day ───────────────────────────────────────────────────

export type Run = {
  /** The shop's date, YYYY-MM-DD. */
  day: string;
  label: string;
  stops: Assessed[];
  /** Stops whose washing is not finished — those hold the van up. */
  notReady: number;
  value: number;
};

/**
 * What has to go out on the van, by day.
 *
 * Separate from the wash queue because it answers a different question. The
 * bands above ask "what must we finish"; this asks "who is driving where, and
 * in what order" — and a stop whose washing is not done is the one that keeps
 * the van waiting, so it is counted rather than buried in the list.
 *
 * Only orders still in the shop appear. Once delivered, CleanCloud marks them
 * collected like any other, and they are somebody else's memory.
 */
export function buildRuns(orders: Order[], now = new Date()): Run[] {
  const today = shopYmd(now);
  const tomorrow = shopYmd(new Date(now.getTime() + DAY));

  /*
    An order on the pending-payment rack has already been driven to the
    customer — the shop is waiting for money, not for a van. Leaving those in
    made six weeks of settled deliveries look like a failed route, when the
    only thing outstanding was the payment, which the collect list already
    tracks.
  */
  const outstanding = orders
    .map((o) => assess(o, now))
    .filter(
      (o) =>
        o.isDelivery &&
        o.status !== STATUS.COLLECTED &&
        o.rack !== PENDING_PAYMENT_RACK
    );

  const byDay = new Map<string, Assessed[]>();
  for (const o of outstanding) {
    const day = o.dueAt ? shopYmd(o.dueAt) : "unscheduled";
    const list = byDay.get(day) ?? [];
    list.push(o);
    byDay.set(day, list);
  }

  const runs: Run[] = [];
  for (const [day, stops] of byDay) {
    // Down the clock, so a route can be driven in the order it is read.
    stops.sort((a, b) => {
      const at = dueMinutes(a.dueTimeLabel);
      const bt = dueMinutes(b.dueTimeLabel);
      if (at !== null && bt !== null && at !== bt) return at - bt;
      if (at !== null && bt === null) return -1;
      if (at === null && bt !== null) return 1;
      return Number(a.id) - Number(b.id);
    });

    const label =
      day === today
        ? "Today"
        : day === tomorrow
          ? "Tomorrow"
          : day === "unscheduled"
            ? "No date set"
            : day < today
              ? `Missed — was due ${day}`
              : day;

    runs.push({
      day,
      label,
      stops,
      notReady: stops.filter((o) => !o.cleaned).length,
      value: stops.reduce((s, o) => s + o.total, 0),
    });
  }

  /*
    Today first, because this list exists to plan a driver and the driver is
    going out today. Days already past come last, under their own label: a
    delivery that never happened is worth seeing, but it is a management
    problem rather than a route.
  */
  const rank = (day: string) => {
    if (day === today) return 0;
    if (day === "unscheduled") return 3;
    if (day > today) return 1;
    return 2;
  };
  return runs.sort((a, b) => {
    const byRank = rank(a.day) - rank(b.day);
    if (byRank !== 0) return byRank;
    // Within upcoming, soonest first; within missed, oldest first.
    return rank(a.day) === 2 ? a.day.localeCompare(b.day) : a.day.localeCompare(b.day);
  });
}

// ── The one-glance summary ─────────────────────────────────────────────

export type Money = { amount: number; count: number };

/**
 * What was actually taken between two days.
 *
 * Read from payments rather than order totals: an order written today and paid
 * next week is next week's money, and a laundry that counts it twice will
 * always think it is doing better than it is.
 */
export async function fetchTakings(dateFrom: string, dateTo: string): Promise<Money> {
  /*
    getPayments treats dateTo as exclusive, and getOrders does not.

    Asking for the 26th to the 26th returns nothing at all; the 26th to the
    27th returns the 26th. So today's takings always read 0.00 and the month
    was short by whatever came in today — 125.03 the day this was found. The
    day after the last day wanted is what has to be sent.
  */
  const dayAfter = shopYmd(new Date(Date.parse(`${dateTo}T00:00:00Z`) + DAY));
  const data = await post("getPayments", { dateFrom, dateTo: dayAfter });
  const list: unknown[] = Array.isArray(data?.payments) ? data.payments : [];
  const amount = list.reduce<number>(
    (s, p) => s + Number((p as { amount?: unknown })?.amount ?? 0),
    0
  );
  return { amount, count: list.length };
}

export type Summary = {
  late: number;
  dueToday: number;
  drivingToday: number;
  takenInToday: number;
  onRack: number;
  onRackValue: number;
  unpaidOnRack: number;
  /*
    Sales and takings are different questions and a laundry needs both. Sales
    is what was written up — the work promised. Takings is what actually
    arrived in the till, which for a shop paid on collection lags behind it by
    days. Showing only one of them hides either the work or the cash.
  */
  salesToday: Money;
  salesMonth: Money;
  revenueToday: Money;
  revenueMonth: Money;
  /** Days from taking it in to having it washed, over the last month. */
  averageTurnaroundDays: number | null;
  /** How far past its promise the worst unwashed order is; 0 means due earlier today. */
  worstDaysLate: number;
  /*
    Carpets go out to a contractor, so part of what was sold is already spoken
    for. Both the bill and the sales figure net of it are kept, because the
    gross is what was traded and the net is what the shop actually earned.
  */
  carpetsToday: CarpetBill;
  carpetsMonth: CarpetBill;
  netSalesToday: number;
  netSalesMonth: number;
};


/*
  Carpets are the one job the shop does not do itself.

  They go out to a contractor who bills by the square metre, so every metre
  sold carries a cost the sales figure does not show. CleanCloud has no notion
  of that cost — it only knows what the customer was charged — so the two rates
  are kept side by side here, and the contractor's half has to be edited by
  hand whenever the deal changes.

  Metres arrive as quantity: a 4.3 m rug is written up as 4.3 "pieces" of the
  per-metre product, which is why the numbers come out fractional.
*/
const CARPETS: { match: RegExp; label: string; charge: number; cost: number }[] = [
  { match: /^machine made carpets/i, label: "Machine made", charge: 1.8, cost: 1.0 },
  { match: /^hand tufted carpets/i, label: "Hand-tufted", charge: 3.3, cost: 2.0 },
  { match: /^handmade carpets \(wool/i, label: "Handmade wool", charge: 5.5, cost: 3.5 },
  { match: /^handmade carpets \(silk/i, label: "Handmade silk", charge: 6.5, cost: 4.0 },
];

export type CarpetLine = {
  label: string;
  metres: number;
  /** What the customer was billed for those metres. */
  charged: number;
  /** What the contractor is owed for them. */
  cost: number;
  orders: number;
};

export type CarpetBill = {
  metres: number;
  charged: number;
  cost: number;
  /** Only the kinds that actually appeared, so an empty month shows nothing. */
  lines: CarpetLine[];
};

/**
 * What the contractor is owed for a set of orders.
 *
 * Read off the item summary rather than a product list, because that is the
 * only place CleanCloud puts quantities. A line it cannot parse is left out
 * rather than guessed at — a wrong bill is worse than a short one.
 */
export function buildCarpetBill(orders: Order[]): CarpetBill {
  const seen = new Map<string, CarpetLine & { ids: Set<string> }>();

  for (const order of orders) {
    // tidy() has already turned CleanCloud's <br> separators into " · ".
    for (const part of (order.summary ?? "").split(" · ")) {
      const line = part.trim();
      if (!line) continue;
      const parsed = line.match(/^(.*?)\s+x\s+([\d.]+)$/i);
      if (!parsed) continue;

      const kind = CARPETS.find((c) => c.match.test(parsed[1].trim()));
      if (!kind) continue;

      const metres = Number(parsed[2]);
      if (!Number.isFinite(metres) || metres <= 0) continue;

      const row =
        seen.get(kind.label) ??
        { label: kind.label, metres: 0, charged: 0, cost: 0, orders: 0, ids: new Set<string>() };
      row.metres += metres;
      row.charged += metres * kind.charge;
      row.cost += metres * kind.cost;
      row.ids.add(order.id);
      seen.set(kind.label, row);
    }
  }

  const lines = CARPETS.map((c) => seen.get(c.label))
    .filter((r): r is CarpetLine & { ids: Set<string> } => r !== undefined)
    .map(({ ids, ...row }) => ({ ...row, orders: ids.size }));

  return {
    metres: lines.reduce((t, l) => t + l.metres, 0),
    charged: lines.reduce((t, l) => t + l.charged, 0),
    cost: lines.reduce((t, l) => t + l.cost, 0),
    lines,
  };
}

export function buildSummary(
  orders: Order[],
  board: Board,
  runs: Run[],
  revenueToday: Money,
  revenueMonth: Money,
  now = new Date()
): Summary {
  const today = shopYmd(now);

  const writtenToday = orders.filter((o) => o.createdAt && shopYmd(o.createdAt) === today);
  const thisMonth = shopYmd(now).slice(0, 7);
  const writtenThisMonth = orders.filter(
    (o) => o.createdAt && shopYmd(o.createdAt).slice(0, 7) === thisMonth
  );
  const takenInToday = writtenToday.length;

  /*
    Turnaround is measured on work finished in the last month, not on
    everything ever — a shop that was slow in January should not still be
    apologising for it in August.
  */
  const monthAgo = now.getTime() - 30 * DAY;
  const finished = orders.filter(
    (o) => o.createdAt && o.cleanedAt && o.cleanedAt.getTime() >= monthAgo
  );
  const averageTurnaroundDays = finished.length
    ? finished.reduce((s, o) => s + (o.cleanedAt!.getTime() - o.createdAt!.getTime()), 0) /
      finished.length /
      DAY
    : null;

  const todayRun = runs.find((r) => r.day === today);

  /*
    Two late orders are not the same news if one is an hour over and the other
    a week, so the count carries its worst case with it.
  */
  const worstDaysLate = board.groups.late.reduce(
    (worst, o) => Math.max(worst, o.daysUntilDue === null ? 0 : Math.max(0, -o.daysUntilDue)),
    0
  );

  const carpetsToday = buildCarpetBill(writtenToday);
  const carpetsMonth = buildCarpetBill(writtenThisMonth);
  const soldToday = writtenToday.reduce((sum, o) => sum + o.total, 0);
  const soldMonth = writtenThisMonth.reduce((sum, o) => sum + o.total, 0);

  return {
    late: board.totals.late,
    worstDaysLate,
    carpetsToday,
    carpetsMonth,
    netSalesToday: soldToday - carpetsToday.cost,
    netSalesMonth: soldMonth - carpetsMonth.cost,
    dueToday: board.totals.dueToday,
    drivingToday: todayRun?.stops.length ?? 0,
    takenInToday,
    salesToday: {
      amount: writtenToday.reduce((sum, o) => sum + o.total, 0),
      count: writtenToday.length,
    },
    salesMonth: {
      amount: writtenThisMonth.reduce((sum, o) => sum + o.total, 0),
      count: writtenThisMonth.length,
    },
    onRack: board.totals.ready,
    onRackValue: board.totals.valueReady,
    unpaidOnRack: board.totals.unpaidReady,
    revenueToday,
    revenueMonth,
    averageTurnaroundDays,
  };
}

/** The first of this month, in the shop's calendar. */
export function monthStart(now = new Date()): string {
  return `${shopYmd(now).slice(0, 7)}-01`;
}

// ── Money handed over but never collected ──────────────────────────────

/**
 * The rack number the shop uses to mean "gone out, still owes us".
 *
 * A shop convention rather than anything CleanCloud knows about, so it lives
 * in the environment and can change without a deploy.
 */
export const PENDING_PAYMENT_RACK = process.env.PENDING_PAYMENT_RACK ?? "200";

export type Debt = Assessed & { daysOwing: number | null };

/**
 * Who owes the shop money for washing already in their hands.
 *
 * Two ways an order gets here: it sits on the pending-payment rack, or
 * CleanCloud has it as collected with nothing paid. Either way the clothes
 * have gone and the money has not, which is the only list in this app where
 * the shop is the one owed something.
 */
export function buildDebts(orders: Order[], now = new Date()): { rows: Debt[]; total: number } {
  const rows = orders
    .filter(
      (o) =>
        !o.paid &&
        o.total > 0 &&
        (o.rack === PENDING_PAYMENT_RACK || o.status === STATUS.COLLECTED)
    )
    .map((o) => {
      const a = assess(o, now);
      // Owing runs from the day it left, or from the day it was washed if it
      // never got a collection stamp.
      const since = o.collectedAt ?? o.cleanedAt ?? o.createdAt;
      return {
        ...a,
        daysOwing: since
          ? Math.floor((Date.parse(`${shopYmd(now)}T00:00:00Z`) - Date.parse(`${shopYmd(since)}T00:00:00Z`)) / DAY)
          : null,
      };
    })
    // Oldest debt first: that is the one least likely to be paid unasked.
    .sort((a, b) => (b.daysOwing ?? 0) - (a.daysOwing ?? 0));

  return { rows, total: rows.reduce((s, o) => s + o.total, 0) };
}
