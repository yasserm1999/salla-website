import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  dueMinutes,
  dueWindowEnd,
  fetchTakings,
  shopYmd,
  type Assessed,
  type Board,
  type Order,
} from "./cleancloud";
import { loadEvents } from "./delivery";
import { loadSpan, shiftDay } from "./pickups";
import { pressingReport } from "./pressing";
import { PRESSERS } from "./press-minutes";
import type { Issue } from "./issues";
import type { StockItem } from "./stock";
import type { Mood } from "./office";

/**
 * The morning meeting's agenda.
 *
 * Seven questions the owner asks every morning, in the order they are asked,
 * each answered from the shop's own records and presented by the worker whose
 * corner it is:
 *
 *   1. What did we sell yesterday?
 *   2. Did the van arrive when it said it would?
 *   3. Is anything missing from the shelf?
 *   4. Has anyone reported a machine fault?
 *   5. What did customers send us, and is anything unanswered or a complaint?
 *   6. Which orders are late?
 *   7. How much did Basel and Sonu press?
 *
 * Everything here is plain data so the browser can draw it; the reading is
 * done on the server and nothing is written.
 */

export type AgendaLine = { text: string; detail?: string; mood?: Mood };

export type AgendaItem = {
  key: string;
  number: number;
  title: string;
  /** Which desk presents it in the meeting. */
  presenter: string;
  mood: Mood;
  /** What the presenter says, in a sentence or two. */
  headline: string;
  lines: AgendaLine[];
  /** A caveat about where the figures come from, when one is owed. */
  note?: string;
  href?: string;
};

export type PressingSummary = {
  ready: boolean;
  people: { name: string; minutes: number; orders: number; holding: number; holdingMinutes: number }[];
};

const DAY = 86_400_000;

const money = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Muscat",
  });

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Midnight to midnight in Muscat, which keeps no daylight saving. */
const dayStart = (day: string) => `${day}T00:00:00+04:00`;

// ── 2. Delivery accuracy ───────────────────────────────────────────────

/**
 * The owner's scale. Inside the promised window, or within a quarter of an
 * hour of it either side, is on time. After that the credit falls in steps.
 */
export function accuracyFor(minutesOff: number): number {
  const off = Math.abs(minutesOff);
  if (off <= 15) return 100;
  if (off <= 30) return 75;
  if (off <= 60) return 50;
  if (off <= 120) return 25;
  return 0;
}

/** Minutes since the start of the shop's day, for an instant. */
function shopMinutes(iso: string): { day: string; minutes: number } {
  const d = new Date(iso);
  const hhmm = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Muscat",
  });
  const [h, m] = hhmm.split(":").map(Number);
  return { day: shopYmd(d), minutes: (h % 24) * 60 + m };
}

/**
 * How far outside the promise it landed, in minutes. Zero anywhere inside a
 * window like "7pm-8pm"; a single time like "5pm" is a window of no width.
 * Early is negative, late is positive.
 */
function minutesOff(
  promisedDay: string,
  start: number,
  end: number,
  at: { day: string; minutes: number }
): number {
  const days = Math.round((Date.parse(`${at.day}T12:00:00Z`) - Date.parse(`${promisedDay}T12:00:00Z`)) / DAY);
  const t = days * 1440 + at.minutes;
  if (t < start) return t - start;
  if (t > end) return t - end;
  return 0;
}

/** "14:30" → minutes. */
function hhmmMinutes(value: string | null): number | null {
  const m = value?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const offWords = (off: number) =>
  off === 0 ? "on time" : `${Math.abs(off)} min ${off > 0 ? "late" : "early"}`;

type Scored = { text: string; detail: string; score: number };

async function deliveryAccuracy(
  yesterday: string,
  history: Order[],
  names: Record<string, string>
): Promise<AgendaItem> {
  const [events, jobs] = await Promise.all([
    loadEvents(yesterday),
    // Nothing is filled in for a day already gone: fillUntil before the span.
    loadSpan(yesterday, yesterday, shiftDay(yesterday, -1)),
  ]);

  const byId = new Map(history.map((o) => [o.id, o]));
  const scored: Scored[] = [];
  const unscored: AgendaLine[] = [];

  // The last delivered mark per order is the one that counts.
  const delivered = new Map<string, string>();
  const failed = new Map<string, string | null>();
  for (const e of events.events) {
    if (!e.orderId) continue;
    if (e.kind === "delivered") delivered.set(e.orderId, e.at);
    if (e.kind === "failed") failed.set(e.orderId, e.reason);
  }

  for (const [id, at] of delivered) {
    const o = byId.get(id);
    const who = (o && names[o.customerID]) || (o ? `customer ${o.customerID}` : "");
    const start = dueMinutes(o?.dueTimeLabel ?? null);
    const end = dueWindowEnd(o?.dueTimeLabel ?? null);
    if (!o?.dueAt || start === null || end === null) {
      unscored.push({ text: `#${id} ${who} — delivered ${clock(at)}`, detail: "no time was promised, so it is not scored" });
      continue;
    }
    const off = minutesOff(shopYmd(o.dueAt), start, end, shopMinutes(at));
    const score = accuracyFor(off);
    scored.push({
      text: `#${id} ${who}`,
      detail: `promised ${o.dueTimeLabel} · delivered ${clock(at)} · ${offWords(off)} → ${score}%`,
      score,
    });
  }

  // Collections and drop-offs from the shop's own book, done by the driver.
  for (const j of jobs.data.jobs) {
    if (j.status !== "done" || !j.doneAt) continue;
    const at = hhmmMinutes(j.atTime);
    const label = `${j.kind === "pickup" ? "Collection" : "Drop-off"} · ${j.person.name}`;
    if (at === null) {
      unscored.push({ text: `${label} — done ${clock(j.doneAt)}`, detail: "no time was booked, so it is not scored" });
      continue;
    }
    const off = minutesOff(j.onDate, at, at, shopMinutes(j.doneAt));
    const score = accuracyFor(off);
    scored.push({
      text: label,
      detail: `booked ${j.atTime} · done ${clock(j.doneAt)} · ${offWords(off)} → ${score}%`,
      score,
    });
  }

  // Promised for yesterday and never marked: the gap in the record is itself news.
  const unmarked = history.filter(
    (o) =>
      o.isDelivery &&
      o.dueAt &&
      shopYmd(o.dueAt) === yesterday &&
      !delivered.has(o.id) &&
      !failed.has(o.id)
  );
  const missedJobs = jobs.data.jobs.filter((j) => j.status === "missed" || j.status === "waiting" || j.status === "out");

  const average = scored.length
    ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length)
    : null;

  const lines: AgendaLine[] = [
    ...scored
      .sort((a, b) => a.score - b.score)
      .map((s) => ({
        text: s.text,
        detail: s.detail,
        mood: (s.score >= 75 ? "calm" : s.score >= 50 ? "busy" : "alert") as Mood,
      })),
    ...[...failed].map(([id, reason]) => ({
      text: `#${id} — delivery failed`,
      detail: reason ?? "no reason given",
      mood: "alert" as Mood,
    })),
    ...unmarked.map((o) => ({
      text: `#${o.id} ${names[o.customerID] ?? ""} — never marked delivered`,
      detail: `was promised ${o.dueTimeLabel ?? "yesterday"}; the driver's app has no record of it`,
      mood: "busy" as Mood,
    })),
    ...missedJobs.map((j) => ({
      text: `${capital(j.kind)} for ${j.person.name} — ${j.status === "missed" ? "missed" : "not marked done"}`,
      detail: j.atTime ? `booked ${j.atTime}` : undefined,
      mood: "busy" as Mood,
    })),
    ...unscored.map((l) => ({ ...l, mood: "calm" as Mood })),
  ];

  return {
    key: "accuracy",
    number: 2,
    title: "Yesterday's delivery accuracy",
    presenter: "delivery",
    mood: average === null ? (unmarked.length ? "busy" : "calm") : average >= 80 ? "calm" : average >= 60 ? "busy" : "alert",
    headline:
      average === null
        ? scored.length + unscored.length === 0
          ? `No deliveries were marked done yesterday${unmarked.length ? `, though ${plural(unmarked.length, "was", "were")} promised` : ""}.`
          : "Nothing yesterday had a promised time to score against."
        : `Yesterday's delivery accuracy was ${average}% across ${plural(scored.length, "stop")}. ` +
          `${scored.filter((s) => s.score === 100).length} right on time` +
          `${scored.some((s) => s.score === 0) ? `, ${scored.filter((s) => s.score === 0).length} more than two hours out` : ""}.` +
          (unmarked.length ? ` ${plural(unmarked.length, "delivery", "deliveries")} never marked.` : ""),
    lines,
    note:
      "On time = inside the promised window or within 15 minutes of it (100%). Up to 30 min out 75%, up to 1 hour 50%, up to 2 hours 25%, beyond that 0%. Times are the driver's own taps in his app.",
    href: "/admin",
  };
}

// ── 1. Sales ───────────────────────────────────────────────────────────

async function sales(yesterday: string, history: Order[]): Promise<AgendaItem> {
  const weekBefore = shiftDay(yesterday, -7);
  const on = (day: string) => history.filter((o) => o.createdAt && shopYmd(o.createdAt) === day);
  const sold = on(yesterday);
  const lastWeek = on(weekBefore);
  const amount = sold.reduce((s, o) => s + o.total, 0);
  const before = lastWeek.reduce((s, o) => s + o.total, 0);
  const taken = await fetchTakings(yesterday, yesterday);

  const change = before > 0 ? Math.round(((amount - before) / before) * 100) : null;
  const weekday = new Date(`${yesterday}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long" });

  const biggest = [...sold].sort((a, b) => b.total - a.total).slice(0, 3);

  return {
    key: "sales",
    number: 1,
    title: "Yesterday's sales",
    presenter: "billing",
    mood: change !== null && change <= -20 ? "alert" : change !== null && change < 0 ? "busy" : "calm",
    headline:
      `Yesterday we sold ${money(amount)} from ${plural(sold.length, "order")}` +
      (sold.length ? `, ${money(amount / sold.length)} an order on average` : "") +
      `. ${money(taken.amount)} actually came in from ${plural(taken.count, "payment")}.` +
      (change !== null
        ? ` That is ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% on the ${weekday} before (${money(before)}).`
        : ""),
    lines: [
      { text: `Sold (orders written)`, detail: `${money(amount)} · ${plural(sold.length, "order")}` },
      { text: `Taken (payments received)`, detail: `${money(taken.amount)} · ${plural(taken.count, "payment")}` },
      {
        text: `${weekday} the week before`,
        detail: `${money(before)} · ${plural(lastWeek.length, "order")}`,
        mood: change !== null && change < 0 ? "busy" : "calm",
      },
      ...biggest.map((o) => ({
        text: `Biggest: #${o.id} — ${money(o.total)}`,
        detail: o.summary ?? undefined,
      })),
    ],
    href: "/admin/revenue",
  };
}

// ── 3. Inventory ───────────────────────────────────────────────────────

function inventory(stock: { ready: boolean; reason?: string; items: StockItem[] }): AgendaItem {
  const out = stock.items.filter((i) => i.onHand <= 0);
  const low = stock.items.filter((i) => i.onHand > 0 && i.lowAt !== null && i.onHand <= i.lowAt);
  const unit = (i: StockItem) => (i.unit ? ` ${i.unit}` : "");
  return {
    key: "inventory",
    number: 3,
    title: "Inventory — anything missing",
    presenter: "supplies",
    mood: out.length ? "alert" : low.length ? "busy" : "calm",
    headline: !stock.ready
      ? "I could not read the stock list this morning."
      : out.length
        ? `${plural(out.length, "item")} run out: ${out.map((i) => i.name).join(", ")}.` +
          (low.length ? ` ${plural(low.length, "more")} running low.` : "")
        : low.length
          ? `Nothing has run out. ${plural(low.length, "item")} at the reorder level: ${low.map((i) => i.name).join(", ")}.`
          : "Nothing is missing and nothing is at its reorder level.",
    lines: [
      ...out.map((i) => ({ text: `${i.name} — none left`, detail: "buy today", mood: "alert" as Mood })),
      ...low.map((i) => ({
        text: `${i.name} — ${i.onHand}${unit(i)} left`,
        detail: `reorder at ${i.lowAt}${unit(i)}`,
        mood: "busy" as Mood,
      })),
    ],
    note: stock.ready ? undefined : stock.reason,
    href: "/admin/issues",
  };
}

// ── 4. Machine faults ──────────────────────────────────────────────────

function machines(issues: Issue[], now: Date): AgendaItem {
  const faults = issues.filter((i) => i.kind === "machinery");
  const open = faults.filter((i) => i.status !== "done");
  const age = (at: string) => Math.floor((now.getTime() - Date.parse(at)) / DAY);
  const fixedLately = faults.filter((i) => i.status === "done" && i.closedAt && age(i.closedAt) <= 1);

  return {
    key: "machines",
    number: 4,
    title: "Machine faults",
    presenter: "quality",
    mood: open.some((i) => !i.assignedTo.length) ? "alert" : open.length ? "busy" : "calm",
    headline: open.length
      ? `${plural(open.length, "machine fault")} still open` +
        `${open.some((i) => !i.assignedTo.length) ? `, ${open.filter((i) => !i.assignedTo.length).length} with nobody on it` : ""}.`
      : `No machine faults are open.${fixedLately.length ? ` ${plural(fixedLately.length, "was", "were")} fixed yesterday.` : ""}`,
    lines: [
      ...open.map((i) => ({
        text: i.description,
        detail: [
          `reported by ${i.raisedBy} ${plural(age(i.raisedAt), "day")} ago`,
          i.assignedTo.length ? `with ${i.assignedTo.join(", ")}` : "nobody assigned",
          i.status === "doing" ? "being fixed" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        mood: (i.assignedTo.length ? "busy" : "alert") as Mood,
      })),
      ...fixedLately.map((i) => ({ text: `Fixed: ${i.description}`, detail: i.closedBy ? `by ${i.closedBy}` : undefined, mood: "calm" as Mood })),
    ],
    href: "/admin/issues",
  };
}

// ── 5. Messages ────────────────────────────────────────────────────────

/** Words that turn a remark into a complaint, in both languages the shop hears. */
const COMPLAINT =
  /late|damag|stain|lost|missing|wrong|bad|dirty|torn|rude|broke|smell|shrink|complain|disappoint|تأخ|تاخ|متأخر|بقع|ضاع|مفقود|سيئ|سيء|وسخ|متسخ|شكوى|خرب|تلف|ممزق|رائحة/i;

type Feedback = {
  at: string;
  quality: number;
  service: number;
  recommend: string | null;
  remarks: string | null;
  name: string | null;
};

async function messages(yesterday: string, today: string): Promise<AgendaItem> {
  const db = client();
  let feedback: Feedback[] = [];
  let rings: { at: string; name: string | null; asked: string | null; ackAt: string | null; ackBy: string | null }[] = [];
  let problem: string | null = db ? null : "Supabase is not configured.";

  if (db) {
    const [f, b] = await Promise.all([
      db
        .from("salla_feedback")
        .select("created_at, rating_quality, rating_service, recommend, remarks, name")
        .gte("created_at", dayStart(yesterday))
        .lt("created_at", dayStart(today))
        .order("created_at", { ascending: false }),
      db
        .from("salla_bell_rings")
        .select("created_at, customer_name, asked, ack_at, ack_by")
        .gte("created_at", dayStart(yesterday))
        .lt("created_at", dayStart(today))
        .order("created_at", { ascending: true }),
    ]);
    if (f.error) problem = `Feedback could not be read: ${f.error.message}`;
    feedback = (f.data ?? []).map((r) => ({
      at: String(r.created_at),
      quality: Number(r.rating_quality),
      service: Number(r.rating_service),
      recommend: (r.recommend as string) ?? null,
      remarks: (r.remarks as string) ?? null,
      name: (r.name as string) ?? null,
    }));
    rings = (b.data ?? []).map((r) => ({
      at: String(r.created_at),
      name: (r.customer_name as string) ?? null,
      asked: (r.asked as string) ?? null,
      ackAt: (r.ack_at as string) ?? null,
      ackBy: (r.ack_by as string) ?? null,
    }));
  }

  const isComplaint = (f: Feedback) =>
    f.quality <= 2 || f.service <= 2 || f.recommend === "no" || (!!f.remarks && COMPLAINT.test(f.remarks));
  const complaints = feedback.filter(isComplaint);
  const unanswered = rings.filter((r) => !r.ackAt);
  const slow = rings.filter((r) => r.ackAt && (Date.parse(r.ackAt) - Date.parse(r.at)) / 60000 > 5);

  const parts = [
    feedback.length ? `${plural(feedback.length, "feedback message")} on the website` : "no feedback on the website",
    rings.length ? `${plural(rings.length, "ring")} of the door bell` : null,
  ].filter(Boolean);

  return {
    key: "messages",
    number: 5,
    title: "Messages received",
    presenter: "customer",
    mood: complaints.length || unanswered.length ? "alert" : slow.length ? "busy" : "calm",
    headline:
      `Yesterday we had ${parts.join(" and ")}.` +
      (complaints.length ? ` ${plural(complaints.length, "of them is a complaint", "of them are complaints")}.` : "") +
      (unanswered.length ? ` ${plural(unanswered.length, "bell ring")} nobody answered.` : "") +
      (!complaints.length && !unanswered.length && (feedback.length || rings.length) ? " Nothing unanswered and no complaints." : ""),
    lines: [
      ...complaints.map((f) => ({
        text: `Complaint from ${f.name ?? "a customer"} — quality ${f.quality}/5, service ${f.service}/5`,
        detail: f.remarks ?? (f.recommend === "no" ? "would not recommend us" : undefined),
        mood: "alert" as Mood,
      })),
      ...unanswered.map((r) => ({
        text: `Bell at ${clock(r.at)} — nobody answered`,
        detail: r.name ?? r.asked ?? "customer not recognised",
        mood: "alert" as Mood,
      })),
      ...slow.map((r) => ({
        text: `Bell at ${clock(r.at)} — answered after ${Math.round((Date.parse(r.ackAt!) - Date.parse(r.at)) / 60000)} min`,
        detail: [r.name, r.ackBy ? `by ${r.ackBy}` : null].filter(Boolean).join(" · ") || undefined,
        mood: "busy" as Mood,
      })),
      ...feedback
        .filter((f) => !isComplaint(f))
        .map((f) => ({
          text: `${f.name ?? "A customer"} — quality ${f.quality}/5, service ${f.service}/5`,
          detail: f.remarks ?? undefined,
          mood: "calm" as Mood,
        })),
    ],
    /*
      Said plainly, because the biggest inbox is the one this cannot see.
    */
    note:
      (problem ? `${problem} ` : "") +
      "WhatsApp is not included: the shop uses the WhatsApp Business phone app, which no website can read. " +
      "Website feedback has no reply record, so “not replied” is only known for the door bell.",
    href: "/feedback/inbox",
  };
}

// ── 6. Late orders ─────────────────────────────────────────────────────

function lateOrders(board: Board, names: Record<string, string>): AgendaItem {
  const late = board.groups.late;
  const name = (o: Assessed) => names[o.customerID] ?? `customer ${o.customerID}`;
  return {
    key: "late",
    number: 6,
    title: "Late orders",
    presenter: "orders",
    mood: late.length ? "alert" : "calm",
    headline: late.length
      ? `${plural(late.length, "order is", "orders are")} late and still not washed, worth ${money(
          late.reduce((s, o) => s + o.total, 0)
        )}.`
      : "No orders are late.",
    lines: late.map((o) => ({
      text: `#${o.id} ${name(o)}`,
      detail: [
        o.daysUntilDue !== null && o.daysUntilDue < 0
          ? `${plural(-o.daysUntilDue, "day")} late`
          : `was due ${o.dueTimeLabel ?? "earlier today"}`,
        o.pieces ? plural(o.pieces, "piece") : null,
        o.summary,
      ]
        .filter(Boolean)
        .join(" · "),
      mood: "alert" as Mood,
    })),
    href: "/admin",
  };
}

// ── 7. Pressing ────────────────────────────────────────────────────────

async function pressing(yesterday: string, today: string): Promise<{ item: AgendaItem; summary: PressingSummary }> {
  const report = await pressingReport(dayStart(yesterday), dayStart(today));
  const people = PRESSERS.map((p) => {
    const done = report.done.filter((r) => r.assignedTo === p);
    const holding = report.open.filter((r) => r.assignedTo === p);
    return {
      name: capital(p),
      minutes: done.reduce((t, r) => t + r.minutes, 0),
      orders: done.length,
      holding: holding.length,
      holdingMinutes: holding.reduce((t, r) => t + r.minutes, 0),
    };
  });
  const total = people.reduce((t, p) => t + p.minutes, 0);

  return {
    summary: { ready: report.ready, people },
    item: {
      key: "pressing",
      number: 7,
      title: "Basel and Sonu — pressing time",
      presenter: "pressing",
      mood: !report.ready ? "busy" : total === 0 ? "busy" : "calm",
      headline: !report.ready
        ? "I could not read the pressing records."
        : `Yesterday ` +
          people.map((p) => `${p.name} pressed ${hm(p.minutes)} (${plural(p.orders, "order")})`).join(" and ") +
          `. ${hm(total)} in all.`,
      lines: people.map((p) => ({
        text: `${p.name}: ${hm(p.minutes)} pressed yesterday`,
        detail:
          `${plural(p.orders, "order")} finished` +
          (p.holding ? ` · holding ${plural(p.holding, "order")} now (${hm(p.holdingMinutes)} of work)` : " · nothing waiting with him now"),
        mood: (p.minutes === 0 ? "busy" : "calm") as Mood,
      })),
      note: "Minutes are each order's expected pressing time, credited when the presser marks it done.",
      href: `/admin/pressing?day=${yesterday}`,
    },
  };
}

// ── Together ───────────────────────────────────────────────────────────

export async function buildAgenda(input: {
  now: Date;
  today: string;
  history: Order[];
  board: Board;
  stock: { ready: boolean; reason?: string; items: StockItem[] };
  issues: Issue[];
  names: Record<string, string>;
}): Promise<{ agenda: AgendaItem[]; pressing: PressingSummary }> {
  const yesterday = shiftDay(input.today, -1);
  const [salesItem, accuracy, inbox, press] = await Promise.all([
    sales(yesterday, input.history),
    deliveryAccuracy(yesterday, input.history, input.names),
    messages(yesterday, input.today),
    pressing(yesterday, input.today),
  ]);
  return {
    agenda: [
      salesItem,
      accuracy,
      inventory(input.stock),
      machines(input.issues, input.now),
      inbox,
      lateOrders(input.board, input.names),
      press.item,
    ],
    pressing: press.summary,
  };
}
