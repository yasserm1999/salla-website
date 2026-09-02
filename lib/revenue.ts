import type { Order } from "./cleancloud";
import { buildCarpetBill, shopYmd } from "./cleancloud";

/**
 * Revenue, month by month, and the arithmetic that gets from what was written
 * up to what the shop actually earned.
 *
 * Three things stand between the two, and all three are shown rather than
 * quietly applied. The owners send their own laundry through the shop, which
 * is real work but not income. Carpets go out to a contractor who bills by the
 * square metre. And the shop opened partway through a month, so July is a
 * short period and comparing it whole against August would flatter August.
 */

/** The day the shop opened. Anything before it was a soft run, not trading. */
export const SHOP_OPENED = "2026-07-09";

/**
 * The owners' own accounts.
 *
 * Customer 1 is Yasser and customer 6 is Osama. Their laundry is done and
 * their orders are written up like anyone else's, so the shop's operational
 * figures should count them — the machines ran, the driver drove. But it is
 * not revenue, and left in it made July look a fifth better than it was.
 */
export const HOUSE_ACCOUNTS = new Set(["1", "6"]);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type DayLine = {
  day: string;
  sales: number;
  orders: number;
  carpetCost: number;
  net: number;
  /** Against the period's average day. Null on a period with no average yet. */
  aboveAverage: boolean | null;
};

export type Period = {
  /** "2026-07" */
  key: string;
  label: string;
  /** "from the 9th", "so far" — why this period is not a whole month. */
  note: string | null;
  from: string;
  to: string;
  isCurrent: boolean;

  /** Everything written up, house accounts included. */
  grossSales: number;
  houseSales: number;
  houseOrders: number;
  /** Gross less the owners' own laundry. */
  customerSales: number;
  carpetCost: number;
  carpetMetres: number;
  /** What the shop earned: customer sales less the contractor. */
  net: number;

  orders: number;
  /** Days the shop actually took an order. */
  tradingDays: number;
  /** Days in the period that have happened. */
  calendarDays: number;
  /** Net over every day in the period, open or not. */
  dailyAverage: number;
  /** Net over the days it actually traded. */
  perTradingDay: number;

  days: DayLine[];
  best: DayLine | null;
  worst: DayLine | null;
  daysAbove: number;
  daysBelow: number;
};

const DAY = 86_400_000;

/** Every calendar day from one date to another, inclusive, as YYYY-MM-DD. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  while (t <= end) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY;
  }
  return out;
}

function lastDayOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * The periods the shop has traded, oldest first.
 *
 * A month is the unit because that is how the shop thinks and how the
 * contractor bills. July starts on opening day rather than the 1st, and the
 * current month stops today — an average taken over a whole month that is
 * only two days old would read as a collapse.
 */
export function buildPeriods(orders: Order[], now = new Date()): Period[] {
  const today = shopYmd(now);

  const dated = orders
    .filter((o) => o.createdAt)
    .map((o) => ({ order: o, day: shopYmd(o.createdAt!) }))
    .filter((r) => r.day >= SHOP_OPENED && r.day <= today);

  const keys: string[] = [];
  for (let k = SHOP_OPENED.slice(0, 7); k <= today.slice(0, 7); ) {
    keys.push(k);
    const [y, m] = k.split("-").map(Number);
    k = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  }

  return keys.map((key) => {
    const isCurrent = key === today.slice(0, 7);
    const opensThisMonth = key === SHOP_OPENED.slice(0, 7);
    const from = opensThisMonth ? SHOP_OPENED : `${key}-01`;
    const to = isCurrent ? today : lastDayOfMonth(key);

    const mine = dated.filter((r) => r.day >= from && r.day <= to);
    const house = mine.filter((r) => HOUSE_ACCOUNTS.has(r.order.customerID));
    const theirs = mine.filter((r) => !HOUSE_ACCOUNTS.has(r.order.customerID));

    const grossSales = mine.reduce((s, r) => s + r.order.total, 0);
    const houseSales = house.reduce((s, r) => s + r.order.total, 0);
    const customerSales = theirs.reduce((s, r) => s + r.order.total, 0);

    // Carpets are charged to customers, so the contractor's share is worked
    // out from customer orders only — the owners' own rugs are not billed on.
    const bill = buildCarpetBill(theirs.map((r) => r.order));
    const net = customerSales - bill.cost;

    const calendar = daysBetween(from, to);
    const byDay = new Map<string, { sales: number; orders: number; carpetCost: number }>();
    for (const r of theirs) {
      const row = byDay.get(r.day) ?? { sales: 0, orders: 0, carpetCost: 0 };
      row.sales += r.order.total;
      row.orders += 1;
      row.carpetCost += buildCarpetBill([r.order]).cost;
      byDay.set(r.day, row);
    }

    const dailyAverage = calendar.length ? net / calendar.length : 0;
    const tradingDays = [...byDay.values()].filter((d) => d.orders > 0).length;

    const days: DayLine[] = calendar.map((day) => {
      const row = byDay.get(day) ?? { sales: 0, orders: 0, carpetCost: 0 };
      const dayNet = row.sales - row.carpetCost;
      return {
        day,
        sales: row.sales,
        orders: row.orders,
        carpetCost: row.carpetCost,
        net: dayNet,
        aboveAverage: dailyAverage > 0 ? dayNet >= dailyAverage : null,
      };
    });

    // Best and worst are read off trading days: a day the shop was shut is not
    // its worst day, it is not a day at all.
    const traded = days.filter((d) => d.orders > 0);
    const best = traded.length ? traded.reduce((a, b) => (b.net > a.net ? b : a)) : null;
    const worst = traded.length ? traded.reduce((a, b) => (b.net < a.net ? b : a)) : null;

    const [, monthNumber] = key.split("-").map(Number);

    return {
      key,
      label: MONTHS[monthNumber - 1],
      note: opensThisMonth ? "from the 9th, when the shop opened" : isCurrent ? "so far" : null,
      from,
      to,
      isCurrent,
      grossSales,
      houseSales,
      houseOrders: house.length,
      customerSales,
      carpetCost: bill.cost,
      carpetMetres: bill.metres,
      net,
      orders: theirs.length,
      tradingDays,
      calendarDays: calendar.length,
      dailyAverage,
      perTradingDay: tradingDays ? net / tradingDays : 0,
      days,
      best,
      worst,
      daysAbove: days.filter((d) => d.aboveAverage === true).length,
      daysBelow: days.filter((d) => d.aboveAverage === false).length,
    };
  });
}

export type LikeForLike = {
  /** How far into the month we are. */
  daysIn: number;
  thisMonth: number;
  lastMonth: number;
  change: number;
  /** Null when there is nothing to compare against. */
  percent: number | null;
};

/**
 * The current month against the same stretch of the previous one.
 *
 * Comparing a month that is two days old against a finished month says
 * nothing. Comparing its first two days against the previous month's first two
 * is a fair question, and the only one worth asking mid-month.
 */
export function likeForLike(periods: Period[]): LikeForLike | null {
  if (periods.length < 2) return null;
  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  if (!current.isCurrent) return null;

  const daysIn = current.calendarDays;
  const thisMonth = current.net;
  const lastMonth = previous.days.slice(0, daysIn).reduce((s, d) => s + d.net, 0);

  return {
    daysIn,
    thisMonth,
    lastMonth,
    change: thisMonth - lastMonth,
    percent: lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : null,
  };
}
