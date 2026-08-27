import type { Order } from "./cleancloud";
import { shopYmd } from "./cleancloud";

/**
 * Who the shop's customers are, and which of them have quietly stopped coming.
 *
 * A laundry loses customers silently. Nobody cancels — they just stop turning
 * up, and by the time it is obvious they have been gone for months. The one
 * signal available is rhythm: somebody who came every fortnight for a year and
 * has not been seen in ten weeks has almost certainly gone somewhere else.
 *
 * So each customer is measured against their own habit rather than a single
 * shop-wide rule. A monthly customer missing for six weeks is unremarkable; a
 * twice-weekly one missing for six weeks is a problem.
 */

export type CustomerRecord = {
  id: string;
  orders: number;
  /** Separate days they came in. Two bags on one trip is one visit. */
  visits: number;
  /** Everything they have ever spent, at what they were charged. */
  spent: number;
  averageOrder: number;
  firstOrder: Date;
  lastOrder: Date;
  daysSinceLast: number;
  /**
   * Their own rhythm: the mean days between one visit and the next. Null when
   * they have not come often enough for there to be a rhythm to speak of.
   */
  averageGapDays: number | null;
  /** How many of their own gaps have passed since they were last seen. */
  overdue: number | null;
  /** Gone for more than three of their own gaps. */
  lapsed: boolean;
};

/** Below this, a "gap" is noise — two orders dropped off on the same trip. */
const MIN_GAP_DAYS = 0.5;

/*
  Two guards, both learned from what the rule caught on real customers.

  A rhythm needs enough visits to be one. Customer 131 came twice on
  consecutive days, which read as a one-day habit, and fifteen quiet days
  later looked fifteen times overdue. Three visits is the least that can
  establish a pattern rather than a coincidence.

  And no absence under a fortnight counts, whatever the arithmetic says.
  Customer 157 came five times in three days and was flagged as lost after
  three — a customer the shop had seen that same week.
*/
const MIN_VISITS_FOR_RHYTHM = 3;
const MIN_ABSENCE_DAYS = 14;

/**
 * The threshold the shop asked for: three times their own frequency.
 *
 * It is deliberately generous. Somebody at twice their usual gap is probably
 * just away; at three times, something has changed.
 */
const LAPSE_MULTIPLE = 3;

const DAY = 86_400_000;

export function buildCustomers(orders: Order[], now = new Date()): CustomerRecord[] {
  const byCustomer = new Map<string, Order[]>();
  for (const order of orders) {
    if (!order.customerID || !order.createdAt) continue;
    const list = byCustomer.get(order.customerID) ?? [];
    list.push(order);
    byCustomer.set(order.customerID, list);
  }

  const records: CustomerRecord[] = [];

  for (const [id, list] of byCustomer) {
    list.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());

    const firstOrder = list[0].createdAt!;
    const lastOrder = list[list.length - 1].createdAt!;
    const spent = list.reduce((sum, o) => sum + o.total, 0);
    const daysSinceLast = (now.getTime() - lastOrder.getTime()) / DAY;

    /*
      Two orders written on the same day are one visit as far as rhythm goes —
      a customer dropping off three bags does not have a twenty-minute habit.
      Counting them separately would collapse the average gap towards zero and
      mark half the shop as lapsed.
     */
    const visits = [...new Set(list.map((o) => shopYmd(o.createdAt!)))];

    const averageGapDays =
      visits.length >= MIN_VISITS_FOR_RHYTHM
        ? Math.max(
            MIN_GAP_DAYS,
            (lastOrder.getTime() - firstOrder.getTime()) / DAY / (visits.length - 1)
          )
        : null;

    const overdue = averageGapDays === null ? null : daysSinceLast / averageGapDays;

    records.push({
      id,
      orders: list.length,
      spent,
      averageOrder: spent / list.length,
      firstOrder,
      lastOrder,
      daysSinceLast,
      averageGapDays,
      overdue,
      visits: visits.length,
      lapsed:
        overdue !== null && overdue > LAPSE_MULTIPLE && daysSinceLast >= MIN_ABSENCE_DAYS,
    });
  }

  // Biggest spenders first: that is the order the shop cares about.
  return records.sort((a, b) => b.spent - a.spent);
}

/**
 * The ones worth a phone call, most valuable first.
 *
 * Ranked by what has been lost rather than by how late they are, because a
 * good customer four gaps overdue matters more than a one-order-a-year
 * customer who is technically ten.
 */
export function lapsedCustomers(records: CustomerRecord[]): CustomerRecord[] {
  return records.filter((r) => r.lapsed).sort((a, b) => b.spent - a.spent);
}

export type CustomerSummary = {
  total: number;
  active: number;
  lapsed: number;
  /** Money the lapsed ones used to spend, over their whole time with the shop. */
  lapsedValue: number;
  /** Too few visits to have a rhythm — cannot be judged either way. */
  unknown: number;
  /** People who came once and never returned. */
  oneTimers: number;
};

export function summariseCustomers(records: CustomerRecord[]): CustomerSummary {
  const lapsed = records.filter((r) => r.lapsed);
  return {
    total: records.length,
    active: records.filter((r) => !r.lapsed && r.averageGapDays !== null).length,
    /** Too few visits to judge — neither lost nor established. */
    unknown: records.filter((r) => r.averageGapDays === null).length,
    lapsed: lapsed.length,
    lapsedValue: lapsed.reduce((s, r) => s + r.spent, 0),
    oneTimers: records.filter((r) => r.visits === 1).length,
  };
}
