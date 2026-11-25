import type { Board, CustomerBrief, Debt, Run, Summary } from "./cleancloud";
import type { CustomerRecord } from "./customers";
import type { Job } from "./pickups";
import type { Issue } from "./issues";
import type { StockItem } from "./stock";

/**
 * The virtual office.
 *
 * Every other admin page is a list somebody has to read and turn into work.
 * This one does the reading: each "worker" sits at a desk, looks at one corner
 * of the shop, and says in a sentence what needs doing, with the jobs under it
 * and, where a customer has to be told something, the message already written.
 *
 * Nothing here sends anything. A message is a WhatsApp link that opens the
 * chat with the words filled in, and a person presses send. The shop runs on
 * the WhatsApp Business app on a phone, which nothing may drive on its own,
 * and a reminder about money should be seen by a human before it goes anyway.
 *
 * Everything below is pure: the page gathers the data, this decides what it
 * means, so the rules can be read in one place and changed without touching
 * a fetch.
 */

export type Mood = "calm" | "busy" | "alert";

export type Draft = { en: string; ar: string };

export type Task = {
  id: string;
  /** What to do, as the worker would say it. */
  text: string;
  /** Smaller line under it: numbers, times, where. */
  detail?: string;
  mood: Mood;
  /** Who it is about, when it is about somebody. */
  person?: { name: string | null; tel: string | null };
  /** Words for that person, when they need telling. */
  draft?: Draft;
  /** Where in the dashboard this is dealt with. */
  href?: string;
};

export type Desk = {
  key: string;
  title: string;
  role: string;
  /** Initials on the desk; there are no photos of people who do not exist. */
  badge: string;
  mood: Mood;
  headline: string;
  tasks: Task[];
  /** Shown when the desk could not read what it watches. */
  problem?: string | null;
};

export type OfficeInput = {
  now: Date;
  today: string;
  board: Board;
  runs: Run[];
  summary: Summary;
  debts: { rows: Debt[]; total: number };
  pickups: { ready: boolean; reason?: string; jobs: Job[] };
  issues: { ready: boolean; reason?: string; issues: Issue[] };
  stock: { ready: boolean; reason?: string; items: StockItem[] };
  lapsed: CustomerRecord[];
  people: Map<string, CustomerBrief>;
};

/** Days on the rack before a customer is reminded, and before it is worrying. */
export const REMIND_AFTER_DAYS = 3;
const WORRY_AFTER_DAYS = 7;
/** A complaint counts as new for this long. */
const FRESH_DAYS = 7;

/** How many of each list a desk shows. A desk is a summary, not the ledger. */
const SHOW = 8;

const money = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rials are written to three places on anything a customer reads. */
const rial = (n: number) => n.toFixed(3);

const worst = (moods: Mood[]): Mood =>
  moods.includes("alert") ? "alert" : moods.includes("busy") ? "busy" : "calm";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "Apt#mq // Apt#mq" is one address said twice. The same rule as tidyAddress
 * in lib/cleancloud, repeated because that module is server-only and this one
 * is also loaded in the browser.
 */
function oneAddress(raw: string | null): string | null {
  if (!raw) return null;
  const joined = [...new Set(raw.split("//").map((h) => h.trim()).filter(Boolean))].join(", ");
  return joined || null;
}

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

// ── What the customer is told ──────────────────────────────────────────

function readyDraft(name: string | null, id: string, pieces: number): Draft {
  const n = firstName(name);
  return {
    en:
      `Hello${n ? ` ${n}` : ""}, this is Salla Laundry. Your order #${id}` +
      `${pieces ? ` (${plural(pieces, "piece")})` : ""} is clean and ready for collection. ` +
      `We look forward to seeing you!`,
    // "عدد القطع" sidesteps Arabic's number agreement, which a template cannot get right.
    ar:
      `مرحباً${n ? ` ${n}` : ""}، معك مغسلة سلَّة. طلبك رقم ${id}` +
      `${pieces ? ` (عدد القطع: ${pieces})` : ""} جاهز للاستلام. ` +
      `بانتظارك!`,
  };
}

function paymentDraft(name: string | null, id: string, amount: number): Draft {
  const n = firstName(name);
  return {
    en:
      `Hello${n ? ` ${n}` : ""}, this is Salla Laundry. A friendly reminder that order #${id} ` +
      `has ${rial(amount)} OMR outstanding. Thank you for choosing us!`,
    ar:
      `مرحباً${n ? ` ${n}` : ""}، معك مغسلة سلَّة. تذكير لطيف بأن الطلب رقم ${id} ` +
      `عليه مبلغ ${rial(amount)} ر.ع غير مدفوع. شكراً لاختيارك لنا!`,
  };
}

/*
  A win-back promises nothing. No discount is offered because none has been
  decided, and a message that invents one commits the shop to it.
*/
function missedYouDraft(name: string | null): Draft {
  const n = firstName(name);
  return {
    en:
      `Hello${n ? ` ${n}` : ""}, this is Salla Laundry. We haven't seen you in a while and ` +
      `wanted to check everything was fine with your last order. ` +
      `We'd love to look after your clothes again. Just reply here to book a pickup.`,
    ar:
      `مرحباً${n ? ` ${n}` : ""}، معك مغسلة سلَّة. اشتقنا لك! أردنا الاطمئنان ` +
      `أن طلبك الأخير كان على ما يرام. يسعدنا الاعتناء بملابسك مرة أخرى، ` +
      `فقط رد على هذه الرسالة لحجز موعد استلام.`,
  };
}

// ── The desks ──────────────────────────────────────────────────────────

function ordersDesk(i: OfficeInput): Desk {
  const late = i.board.groups.late;
  const today = i.board.groups.today;
  const tasks: Task[] = [
    ...late.slice(0, SHOW).map<Task>((o) => ({
      id: `late-${o.id}`,
      text: `Finish order #${o.id}`,
      detail: [
        o.daysUntilDue !== null && o.daysUntilDue < 0
          ? `${plural(-o.daysUntilDue, "day")} late`
          : `was due ${o.dueTimeLabel ?? "earlier today"}`,
        o.pieces ? plural(o.pieces, "piece") : null,
        o.summary,
      ]
        .filter(Boolean)
        .join(" · "),
      mood: "alert",
      href: "/admin",
    })),
    ...today.slice(0, Math.max(0, SHOW - late.length)).map<Task>((o) => ({
      id: `today-${o.id}`,
      text: `Order #${o.id} is due today`,
      detail: [o.dueTimeLabel, o.pieces ? plural(o.pieces, "piece") : null, o.summary]
        .filter(Boolean)
        .join(" · "),
      mood: "busy",
      href: "/admin",
    })),
  ];

  const headline = late.length
    ? `${plural(late.length, "order")} late and not washed — ${
        i.summary.worstDaysLate > 0
          ? `the worst is ${plural(i.summary.worstDaysLate, "day")} over`
          : "past the hour promised today"
      }.${today.length ? ` ${today.length} more due today.` : ""}`
    : today.length
      ? `Nothing late. ${plural(today.length, "order")} to finish today.`
      : `Nothing late and nothing due today. ${plural(i.board.totals.owed, "order")} in the queue.`;

  return {
    key: "orders",
    title: "Orders Officer",
    role: "Watches the wash queue against what was promised",
    badge: "OO",
    mood: late.length ? "alert" : today.length ? "busy" : "calm",
    headline,
    tasks,
  };
}

function customerDesk(i: OfficeInput): Desk {
  const waiting = i.board.groups.ready.filter((o) => (o.daysOnRack ?? 0) >= REMIND_AFTER_DAYS);
  const old = waiting.filter((o) => (o.daysOnRack ?? 0) >= WORRY_AFTER_DAYS);

  const tasks = waiting.slice(0, SHOW).map<Task>((o) => {
    const p = i.people.get(o.customerID);
    return {
      id: `ready-${o.id}`,
      text: `Tell ${p?.name ?? `customer ${o.customerID}`} order #${o.id} is ready`,
      detail: [
        `${plural(o.daysOnRack ?? 0, "day")} on the rack`,
        o.rack ? `rack ${o.rack}` : null,
        o.paid ? "paid" : `${money(o.total)} to pay`,
      ]
        .filter(Boolean)
        .join(" · "),
      mood: (o.daysOnRack ?? 0) >= WORRY_AFTER_DAYS ? "busy" : "calm",
      person: { name: p?.name ?? null, tel: p?.tel ?? null },
      draft: readyDraft(p?.name ?? null, o.id, o.pieces),
    };
  });

  return {
    key: "customer",
    title: "Customer Agent",
    role: "Writes to customers whose washing is waiting",
    badge: "CA",
    mood: old.length ? "busy" : "calm",
    headline: waiting.length
      ? `${plural(waiting.length, "order")} waiting ${REMIND_AFTER_DAYS}+ days for collection` +
        `${old.length ? `, ${old.length} of them over a week` : ""}. Reminders are written below.`
      : `No one has left washing on the rack for ${REMIND_AFTER_DAYS} days or more.`,
    tasks,
  };
}

function deliveryDesk(i: OfficeInput): Desk {
  const todayRun = i.runs.find((r) => r.day === i.today);
  const missedRuns = i.runs.filter((r) => r.day !== "unscheduled" && r.day < i.today);
  const missedStops = missedRuns.reduce((s, r) => s + r.stops.length, 0);
  const jobsToday = i.pickups.jobs.filter((j) => j.onDate === i.today);
  const collections = jobsToday.filter((j) => j.status === "waiting" || j.status === "out");
  const failed = jobsToday.filter((j) => j.status === "missed");

  const tasks: Task[] = [];
  for (const s of (todayRun?.stops ?? []).slice(0, SHOW)) {
    const p = i.people.get(s.customerID);
    tasks.push({
      id: `drop-${s.id}`,
      text: `Deliver #${s.id}${p?.name ? ` to ${p.name}` : ""}`,
      detail: [s.dueTimeLabel, oneAddress(s.address) ?? p?.place ?? null, s.cleaned ? null : "not washed yet"]
        .filter(Boolean)
        .join(" · "),
      mood: s.cleaned ? "calm" : "alert",
      href: "/admin",
    });
  }
  for (const j of collections.slice(0, Math.max(0, SHOW - tasks.length))) {
    tasks.push({
      id: `pick-${j.id}`,
      text: `${j.kind === "pickup" ? "Collect from" : "Take back to"} ${j.person.name}`,
      detail: [j.atTime, j.person.address, j.status === "out" ? "driver on the way" : null]
        .filter(Boolean)
        .join(" · "),
      mood: "calm",
      href: "/admin/pickups",
    });
  }
  if (missedStops) {
    tasks.push({
      id: "missed-runs",
      text: `${plural(missedStops, "delivery", "deliveries")} from earlier days never went out`,
      detail: missedRuns.map((r) => r.day).join(", "),
      mood: "alert",
      href: "/admin",
    });
  }

  const stops = todayRun?.stops.length ?? 0;
  const notReady = todayRun?.notReady ?? 0;
  const parts = [
    stops ? `${plural(stops, "delivery", "deliveries")} today` : "No deliveries today",
    collections.length ? `${plural(collections.length, "collection")}` : null,
  ].filter(Boolean);

  return {
    key: "delivery",
    title: "Delivery Scheduler",
    role: "Plans the van: drops, collections and what holds it up",
    badge: "DS",
    mood: missedStops || failed.length || notReady ? "alert" : stops || collections.length ? "busy" : "calm",
    headline:
      parts.join(" and ") +
      "." +
      (notReady ? ` ${plural(notReady, "stop")} not washed yet — the van will wait on those.` : "") +
      (failed.length ? ` ${plural(failed.length, "collection")} missed today.` : ""),
    tasks,
    problem: i.pickups.ready ? null : (i.pickups.reason ?? null),
  };
}

function billingDesk(i: OfficeInput): Desk {
  const rows = i.debts.rows.filter((d) => (d.daysOwing ?? 0) >= 1);
  const tasks = rows.slice(0, SHOW).map<Task>((d) => {
    const p = i.people.get(d.customerID);
    return {
      id: `debt-${d.id}`,
      text: `Ask ${p?.name ?? `customer ${d.customerID}`} to pay for #${d.id}`,
      detail: [`${money(d.total)} owed`, d.daysOwing !== null ? `${plural(d.daysOwing, "day")}` : null]
        .filter(Boolean)
        .join(" · "),
      mood: (d.daysOwing ?? 0) >= WORRY_AFTER_DAYS ? "alert" : "busy",
      person: { name: p?.name ?? null, tel: p?.tel ?? null },
      draft: paymentDraft(p?.name ?? null, d.id, d.total),
    };
  });

  const s = i.summary;
  return {
    key: "billing",
    title: "Billing Clerk",
    role: "Counts the till and chases what is owed",
    badge: "BC",
    mood: rows.some((d) => (d.daysOwing ?? 0) >= WORRY_AFTER_DAYS) ? "alert" : rows.length ? "busy" : "calm",
    headline:
      `Taken today ${money(s.revenueToday.amount)} from ${plural(s.revenueToday.count, "payment")}; ` +
      `sold ${money(s.salesToday.amount)}. ` +
      (i.debts.total > 0
        ? `${money(i.debts.total)} owed by customers who already have their washing.`
        : "Nobody owes for washing they already have."),
    tasks,
  };
}

function suppliesDesk(i: OfficeInput): Desk {
  const low = i.stock.items.filter((it) => it.lowAt !== null && it.onHand <= it.lowAt);
  const out = low.filter((it) => it.onHand <= 0);
  const pending = i.stock.items.filter((it) => it.pending);

  const tasks: Task[] = [
    ...low.slice(0, SHOW).map<Task>((it) => ({
      id: `stock-${it.id}`,
      text: it.onHand <= 0 ? `Out of ${it.name} — buy now` : `Reorder ${it.name}`,
      detail: `${it.onHand}${it.unit ? ` ${it.unit}` : ""} left · reorder at ${it.lowAt}`,
      mood: it.onHand <= 0 ? "alert" : "busy",
      href: "/admin/issues",
    })),
    ...(pending.length
      ? [
          {
            id: "stock-pending",
            text: `Approve ${plural(pending.length, "new stock item")}`,
            detail: pending.map((p) => p.name).slice(0, 4).join(", "),
            mood: "calm" as Mood,
            href: "/admin/issues",
          },
        ]
      : []),
  ];

  return {
    key: "supplies",
    title: "Supplies Manager",
    role: "Keeps detergent, bags and hangers on the shelf",
    badge: "SM",
    mood: out.length ? "alert" : low.length ? "busy" : "calm",
    headline: !i.stock.ready
      ? "Could not read the stock list."
      : low.length
        ? `${plural(low.length, "item")} at or below the reorder level${out.length ? `, ${out.length} run out` : ""}.`
        : i.stock.items.some((it) => it.lowAt !== null)
          ? "Everything with a reorder level is above it."
          : "No reorder levels are set yet — add them on the stock list so I can warn you.",
    tasks,
    problem: i.stock.ready ? null : (i.stock.reason ?? null),
  };
}

function complaintsDesk(i: OfficeInput): Desk {
  const open = i.issues.issues.filter((x) => x.status !== "done");
  const complaints = open.filter((x) => x.kind === "customer");
  const machines = open.filter((x) => x.kind === "machinery");
  const ageDays = (at: string) => Math.floor((i.now.getTime() - Date.parse(at)) / 86_400_000);

  /*
    A complaint is new for a few days and then it is a record waiting to be
    closed. Only a fresh one, or a machine nobody has taken on, is red: a
    month-old complaint left open is tidying, not an emergency.
  */
  const fresh = (x: Issue) => ageDays(x.raisedAt) <= FRESH_DAYS;
  const urgent = (x: Issue) =>
    x.kind === "customer" ? fresh(x) : !x.assignedTo.length && x.status !== "doing";

  const tasks = [...complaints, ...machines]
    .sort((a, b) => Number(urgent(b)) - Number(urgent(a)))
    .slice(0, SHOW)
    .map<Task>((x) => ({
      id: `issue-${x.id}`,
      text: `${x.kind === "customer" ? "Complaint" : "Machine fault"}: ${x.description}`,
      detail: [
        x.customerName,
        `raised by ${x.raisedBy}`,
        `${plural(ageDays(x.raisedAt), "day")} ago`,
        x.kind === "machinery"
          ? x.assignedTo.length
            ? `with ${x.assignedTo.join(", ")}`
            : "nobody assigned"
          : null,
        x.status === "doing" ? "in progress" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      mood: urgent(x) ? "alert" : "busy",
      href: "/admin/issues",
    }));

  const freshComplaints = complaints.filter(fresh).length;
  const stale = complaints.length - freshComplaints;

  return {
    key: "quality",
    title: "Quality & Complaints",
    role: "Makes sure every complaint and breakdown is answered",
    badge: "QC",
    mood: tasks.some((t) => t.mood === "alert") ? "alert" : tasks.length ? "busy" : "calm",
    headline:
      complaints.length || machines.length
        ? [
            freshComplaints ? `${plural(freshComplaints, "new complaint")} this week` : null,
            machines.length ? `${plural(machines.length, "open machine fault")}` : null,
            stale ? `${plural(stale, "older complaint")} still open — close them once dealt with` : null,
          ]
            .filter(Boolean)
            .join("; ") + "."
        : "No open complaints or machine faults.",
    tasks,
    problem: i.issues.ready ? null : (i.issues.reason ?? null),
  };
}

function marketingDesk(i: OfficeInput): Desk {
  const value = i.lapsed.reduce((s, r) => s + r.spent, 0);
  const tasks = i.lapsed.slice(0, SHOW).map<Task>((r) => {
    const p = i.people.get(r.id);
    return {
      id: `lapsed-${r.id}`,
      text: `Win back ${p?.name ?? `customer ${r.id}`}`,
      detail: [
        `usually every ${Math.round(r.averageGapDays ?? 0)} days`,
        `last seen ${Math.round(r.daysSinceLast)} days ago`,
        `${money(r.spent)} spent`,
      ].join(" · "),
      mood: "busy",
      person: { name: p?.name ?? null, tel: p?.tel ?? null },
      draft: missedYouDraft(p?.name ?? null),
    };
  });

  return {
    key: "marketing",
    title: "Marketing Officer",
    role: "Notices regulars who stopped coming and brings them back",
    badge: "MO",
    mood: i.lapsed.length ? "busy" : "calm",
    headline: i.lapsed.length
      ? `${plural(i.lapsed.length, "regular")} stopped coming — they spent ${money(value)} with us. ` +
        `Start with the biggest.`
      : "No regular customers have gone quiet.",
    tasks,
  };
}

/**
 * The manager reads every other desk and says the day in a few lines.
 *
 * It owns no data of its own on purpose: a manager who keeps separate figures
 * soon disagrees with the people who do the work.
 */
function managerDesk(desks: Desk[], i: OfficeInput): Desk {
  const urgent = desks.filter((d) => d.mood === "alert");
  const busy = desks.filter((d) => d.mood === "busy");
  const s = i.summary;

  const tasks: Task[] = [...urgent, ...busy].map((d) => ({
    id: `brief-${d.key}`,
    text: `${d.title}: ${d.headline}`,
    mood: d.mood,
    href: `#desk-${d.key}`,
  }));

  return {
    key: "manager",
    title: "Office Manager",
    role: "Reads every desk and tells you where to look first",
    badge: "OM",
    mood: worst(desks.map((d) => d.mood)),
    headline:
      `${plural(s.takenInToday, "order")} taken in today, ${plural(s.onRack, "order")} on the rack, ` +
      `${plural(s.late, "late order")}. ` +
      (urgent.length
        ? `${plural(urgent.length, "desk needs", "desks need")} you now: ${urgent.map((d) => d.title).join(", ")}.`
        : busy.length
          ? "Nothing urgent — a few things to get through."
          : "A quiet day. Everything is under control."),
    tasks,
  };
}

export function buildOffice(i: OfficeInput): Desk[] {
  const desks = [
    ordersDesk(i),
    customerDesk(i),
    deliveryDesk(i),
    billingDesk(i),
    suppliesDesk(i),
    complaintsDesk(i),
    marketingDesk(i),
  ];
  return [managerDesk(desks, i), ...desks];
}

/**
 * The customer IDs whose names and numbers the desks will show.
 *
 * CleanCloud allows about forty lookups before a page starts to drag, so only
 * the people a desk will actually put on screen are asked for.
 */
export function peopleWanted(
  board: Board,
  runs: Run[],
  debts: { rows: Debt[] },
  lapsed: CustomerRecord[],
  today: string
): string[] {
  const ids = [
    ...board.groups.ready
      .filter((o) => (o.daysOnRack ?? 0) >= REMIND_AFTER_DAYS)
      .slice(0, SHOW)
      .map((o) => o.customerID),
    ...debts.rows.filter((d) => (d.daysOwing ?? 0) >= 1).slice(0, SHOW).map((d) => d.customerID),
    ...lapsed.slice(0, SHOW).map((r) => r.id),
    ...(runs.find((r) => r.day === today)?.stops ?? []).slice(0, SHOW).map((o) => o.customerID),
  ];
  return [...new Set(ids.filter(Boolean))];
}

/**
 * A number WhatsApp can open a chat with.
 *
 * Omani mobiles are eight digits, written locally without the country code;
 * wa.me wants the whole international number with no plus and no spaces.
 */
export function whatsappNumber(tel: string | null): string | null {
  if (!tel) return null;
  let digits = tel.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `968${digits}`;
  return digits.length >= 10 ? digits : null;
}
