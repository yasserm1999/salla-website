"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Assessed, Board as BoardData, Debt, Order, Run, Summary, Urgency } from "@/lib/cleancloud";
import type { Concern, RunStatus, StopProgress } from "@/lib/delivery";

export type DeliveryView = {
  status: RunStatus;
  concerns: Concern[];
  states: Record<string, StopProgress>;
  ready: boolean;
  problem: string | null;
};

/**
 * The dashboard.
 *
 * The order of this page is the order of the day: what is already broken,
 * what breaks today, who is driving, then everything with time in hand.
 * Money owed comes last — it is the only list here where the shop is waiting
 * on somebody else rather than the other way round.
 */

type Slot = Urgency | "deliveries" | "debts";

const ORDER: Slot[] = [
  "late",
  "today",
  "deliveries",
  "tomorrow",
  "inTwo",
  "later",
  "ready",
  "debts",
];

const BANDS: Record<
  Urgency,
  { title: string; blurb: string; ring: string; chip: string; bar: string }
> = {
  late: {
    title: "Late — still not washed",
    blurb: "Promised for a day already gone, and the work is not done.",
    ring: "border-red-300 bg-red-50",
    chip: "bg-red-600 text-white",
    bar: "bg-red-600",
  },
  today: {
    title: "Due today",
    blurb: "Everything promised for today, driven or collected.",
    ring: "border-amber-300 bg-amber-50",
    chip: "bg-amber-500 text-white",
    bar: "bg-amber-500",
  },
  tomorrow: {
    title: "Tomorrow",
    blurb: "Wash today if the day allows it.",
    ring: "border-sky-300 bg-sky-50",
    chip: "bg-sky-600 text-white",
    bar: "bg-sky-600",
  },
  inTwo: {
    title: "In two days",
    blurb: "Comfortable, but worth knowing the size of.",
    ring: "border-indigo-200 bg-indigo-50",
    chip: "bg-indigo-500 text-white",
    bar: "bg-indigo-400",
  },
  later: {
    title: "Further out — everything else",
    blurb: "Taken in, with more than two days in hand.",
    ring: "border-[#ece7e1] bg-white",
    chip: "bg-[#e6dccf] text-[#546d83]",
    bar: "bg-[#d8cbbd]",
  },
  ready: {
    title: "Sitting on the rack",
    blurb: "Washed and waiting for the customer. None of this is the shop being late.",
    ring: "border-emerald-200 bg-emerald-50",
    chip: "bg-emerald-600 text-white",
    bar: "bg-emerald-500",
  },
  collected: { title: "", blurb: "", ring: "", chip: "", bar: "" },
};

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2026-08-27" as a person says it: "Thu 27 Aug". */
function runDay(day: string): string {
  const parsed = Date.parse(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed)) return "";
  // Pinned rather than left to the locale: this renders on a server with no
  // opinion, which defaults to the American month-first order.
  return new Date(parsed).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function whenLabel(o: Assessed): string {
  const time = o.dueTimeLabel ? ` ${o.dueTimeLabel}` : "";
  if (o.daysUntilDue === null) return "no promised date";
  // Promised for earlier today and the hour has gone by.
  if (o.daysUntilDue === 0 && o.urgency === "late") {
    return `overdue — was due${time || " earlier today"}`;
  }
  if (o.daysUntilDue < 0) {
    const d = Math.abs(o.daysUntilDue);
    return `${d} day${d === 1 ? "" : "s"} late${time ? ` · was due${time}` : ""}`;
  }
  if (o.daysUntilDue === 0) return `today${time}`;
  if (o.daysUntilDue === 1) return `tomorrow${time}`;
  return `in ${o.daysUntilDue} days${time}`;
}

export function Board({
  board,
  runs,
  debts,
  summary,
  admin,
  delivery,
  unreviewed,
  reviewsReady,
}: {
  board: BoardData;
  runs: Run[];
  debts: { rows: Debt[]; total: number };
  summary: Summary;
  admin: string;
  delivery: DeliveryView;
  unreviewed: Order[];
  reviewsReady: boolean;
}) {
  const router = useRouter();
  const s = summary;
  const [reviewing, setReviewing] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const news = unreviewed.filter((o) => !reviewed.has(o.id));

  async function review(ids: string[]) {
    setReviewing(true);
    // Cleared on screen at once; the server catches up behind.
    setReviewed((prev) => new Set([...prev, ...ids]));
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids }),
      });
      if (!res.ok) setReviewed((prev) => new Set([...prev].filter((x) => !ids.includes(x))));
      else router.refresh();
    } catch {
      setReviewed((prev) => new Set([...prev].filter((x) => !ids.includes(x))));
    } finally {
      setReviewing(false);
    }
  }

  const [open, setOpen] = useState<Record<string, boolean>>({
    late: true,
    today: true,
    deliveries: true,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  /*
    Names arrive after the board does.

    CleanCloud rate-limits customer lookups, so fetching them while the page
    rendered cost ten seconds for names most of which nobody opens. Each list
    now asks for its own when it is shown, and what comes back is kept for the
    rest of the visit.
  */
  const [people, setPeople] = useState<Record<string, { name: string | null; tel: string | null }>>(
    {}
  );
  const [looking, setLooking] = useState(false);

  const lookUp = useCallback(async (ids: string[]) => {
    const wanted = [...new Set(ids.filter(Boolean))];
    if (wanted.length === 0) return;
    setLooking(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: wanted }),
      });
      const data = await res.json();
      if (data?.people) setPeople((prev) => ({ ...prev, ...data.people }));
    } catch {
      // Names are a convenience; the board is perfectly usable without them.
    } finally {
      setLooking(false);
    }
  }, []);

  const nameOf = (o: { customerID: string; customerName?: string | null }) =>
    people[o.customerID]?.name ?? o.customerName ?? `Customer ${o.customerID}`;
  const telOf = (o: { customerID: string; customerTel?: string | null }) =>
    people[o.customerID]?.tel ?? o.customerTel ?? null;

  // Whatever is on screen earns its names; opening a list asks for the rest.
  useEffect(() => {
    const showing: { customerID: string }[] = [];
    for (const slot of ORDER) {
      if (!open[slot]) continue;
      if (slot === "deliveries") showing.push(...runs.flatMap((r) => r.stops));
      else if (slot === "debts") showing.push(...debts.rows);
      else showing.push(...board.groups[slot as Urgency]);
    }
    const missing = showing.map((o) => o.customerID).filter((id) => id && !(id in people));
    if (missing.length > 0) void lookUp(missing.slice(0, 60));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board, runs, debts]);

  async function signOut() {
    await fetch("/api/admin", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  const toggle = (slot: string) => setOpen((st) => ({ ...st, [slot]: !st[slot] }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#ece7e1] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Shop dashboard</h1>
          <p className="text-sm text-[#8a9099]">
            read{" "}
            {new Date(board.generatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {looking && <span className="ml-2 text-[#b8b1a8]">· fetching names…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/revenue"
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
          >
            Revenue
          </Link>
          <Link
            href="/admin/customers"
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
          >
            Customers
          </Link>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
          >
            Refresh
          </button>
          <button
            onClick={signOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#8a9099] hover:text-[#3f4f61]"
          >
            Sign out ({admin})
          </button>
        </div>
      </header>

      {/*
        What has happened since you last looked.

        A sales figure going up tells you something was sold and not what. Every
        order stays here until it has actually been read, then drops out — so
        the board goes back to being about work rather than about news.
      */}
      {news.length > 0 && (
        <section className="mb-5 overflow-hidden rounded-2xl border-2 border-[#d8b98a] bg-[#f8f1e7]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#26364d]">{news.length}</span>
              <span className="text-sm font-bold uppercase tracking-widest text-[#b9925d]">
                new order{news.length === 1 ? "" : "s"} to look at
              </span>
              <span className="text-sm font-bold text-[#546d83]">
                {money(news.reduce((t, o) => t + o.total, 0))}
              </span>
            </p>
            <button
              onClick={() => review(news.map((o) => o.id))}
              disabled={reviewing || !reviewsReady}
              className="rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white hover:bg-[#3f4f61] disabled:opacity-50"
            >
              Reviewed — clear all
            </button>
          </div>

          {!reviewsReady && (
            <p className="border-t border-[#e6dccf] bg-amber-50 px-4 py-2 text-xs text-amber-900">
              These cannot be cleared yet — run supabase/setup.sql.
            </p>
          )}

          <ul className="divide-y divide-[#e6dccf] border-t border-[#e6dccf] bg-white/70">
            {news.slice(0, 30).map((o) => (
              <li key={o.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="rounded bg-[#26364d] px-1.5 text-sm font-bold text-white">
                      #{o.id}
                    </span>
                    <span className="font-medium text-[#26364d]">{nameOf(o)}</span>
                    <span className="text-xs text-[#b8b1a8]">
                      c{o.customerID}
                      {o.createdAt &&
                        ` · ${new Date(o.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                    </span>
                  </p>
                  <p className="truncate text-xs text-[#8a9099]">
                    {o.summary || `${o.pieces} pieces`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-[#26364d]">
                  {money(o.total)}
                </span>
                <button
                  onClick={() => review([o.id])}
                  disabled={reviewing || !reviewsReady}
                  className="shrink-0 rounded border border-[#d8cbbd] px-2 py-1 text-xs font-bold text-[#546d83] hover:border-[#26364d] hover:text-[#26364d] disabled:opacity-40"
                >
                  Seen
                </button>
              </li>
            ))}
          </ul>
          {news.length > 30 && (
            <p className="border-t border-[#e6dccf] px-4 py-2 text-xs text-[#8a9099]">
              and {news.length - 30} more
            </p>
          )}
        </section>
      )}

      {/* ── Where the van is ───────────────────────────────────────── */}
      <OnTheRoad delivery={delivery} runs={runs} nameOf={nameOf} />

      {/*
        Three weights, in the order the eye should travel.

        Sales first and largest — the work written up is the shop's real
        trade, and cash follows it in on its own schedule. Then what is at
        risk, in the colours that mean risk. Payments and the rest are
        context: true, worth having, never worth looking at before those two.
      */}

      {/* ── Today's trade ─────────────────────────────────────────── */}
      <section className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-[#26364d] bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a9099]">Sold today</p>
          <p className="mt-1 text-5xl font-black leading-none tracking-tight text-[#26364d]">
            {money(s.salesToday.amount)}
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#8a9099]">
            {s.salesToday.count} order{s.salesToday.count === 1 ? "" : "s"} written today
          </p>
          <p className="mt-1.5 border-t border-[#f0e9df] pt-1.5 text-xs text-[#8a9099]">
            Yesterday{" "}
            <span className="font-bold text-[#546d83]">{money(s.salesYesterday.amount)}</span>{" "}
            <span className="text-[#b8b1a8]">({s.salesYesterday.count})</span>
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#26364d] bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a9099]">
            Sold this month
          </p>
          <p className="mt-1 text-5xl font-black leading-none tracking-tight text-[#26364d]">
            {money(s.salesMonth.amount)}
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#8a9099]">
            {s.salesMonth.count} order{s.salesMonth.count === 1 ? "" : "s"} this month
          </p>
          <p className="mt-1.5 border-t border-[#f0e9df] pt-1.5 text-xs text-[#8a9099]">
            Same point last month{" "}
            <span className="font-bold text-[#546d83]">
              {money(s.salesLastMonthToDate.amount)}
            </span>{" "}
            <Delta now={s.salesMonth.amount} then={s.salesLastMonthToDate.amount} />
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#d8cbbd] bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8a9099]">
            Orders in today
          </p>
          <p className="mt-1 text-5xl font-black leading-none tracking-tight text-[#26364d]">
            {s.takenInToday}
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#8a9099]">
            {s.drivingToday} to be driven out
          </p>
        </div>
      </section>


      {/*
        What the month leaves behind.

        Carpets are sold by the shop but washed by somebody else, so part of
        the sales figure above was never the shop's to keep. The subtraction is
        shown rather than hidden so the net is auditable at a glance.
      */}
      <section className="mb-6 rounded-2xl border-2 border-[#26364d] bg-[#26364d] px-5 py-4 text-white">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-[#b8b1a8]">
              Sold this month
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#ece7e1]">
              {money(s.salesMonth.amount)}
            </p>
          </div>

          <div className="pb-1 text-2xl font-light text-[#8a9099]">−</div>

          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-rose-300">
              Carpet contractor
            </p>
            <p className="text-2xl font-bold tabular-nums text-rose-300">
              {money(s.carpetsMonth.cost)}
            </p>
          </div>

          <div className="pb-1 text-2xl font-light text-[#8a9099]">=</div>

          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300">
              Net to the shop
            </p>
            <p className="text-4xl font-black tabular-nums leading-none text-emerald-300">
              {money(s.netSalesMonth)}
            </p>
          </div>
        </div>

        {s.carpetsMonth.lines.length > 0 ? (
          <p className="mt-3 border-t border-[#46586f] pt-2.5 text-xs text-[#b8b1a8]">
            {s.carpetsMonth.metres.toFixed(2)} m² out to the contractor ·{" "}
            {s.carpetsMonth.lines
              .map((l) => `${l.label} ${l.metres.toFixed(2)} m² = ${money(l.cost)}`)
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-3 border-t border-[#46586f] pt-2.5 text-xs text-[#b8b1a8]">
            No carpets sold this month.
          </p>
        )}
      </section>

      {/* ── What is at risk ───────────────────────────────────────── */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-2xl border-2 px-5 py-3.5 ${
            s.late > 0 ? "border-red-500 bg-red-50" : "border-emerald-300 bg-emerald-50"
          }`}
        >
          <div className="flex items-baseline gap-3">
            <p
              className={`text-4xl font-black leading-none ${
                s.late > 0 ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {s.late}
            </p>
            <p
              className={`text-sm font-bold uppercase tracking-wider ${
                s.late > 0 ? "text-red-700" : "text-emerald-700"
              }`}
            >
              Late
            </p>
          </div>
          <p className={`mt-1 text-xs ${s.late > 0 ? "text-red-700/80" : "text-emerald-700/80"}`}>
            {s.late > 0
              ? `still not washed · worst ${s.worstDaysLate === 0 ? "overdue today" : `${s.worstDaysLate}d over`}`
              : "nothing has been missed"}
          </p>
        </div>

        <div
          className={`rounded-2xl border-2 px-5 py-3.5 ${
            s.dueToday > 0 ? "border-amber-500 bg-amber-50" : "border-[#ece7e1] bg-white"
          }`}
        >
          <div className="flex items-baseline gap-3">
            <p
              className={`text-4xl font-black leading-none ${
                s.dueToday > 0 ? "text-amber-700" : "text-[#26364d]"
              }`}
            >
              {s.dueToday}
            </p>
            <p
              className={`text-sm font-bold uppercase tracking-wider ${
                s.dueToday > 0 ? "text-amber-700" : "text-[#8a9099]"
              }`}
            >
              Due today
            </p>
          </div>
          <p
            className={`mt-1 text-xs ${s.dueToday > 0 ? "text-amber-700/80" : "text-[#8a9099]"}`}
          >
            {s.dueToday > 0 ? "to finish before the hour promised" : "nothing left for today"}
          </p>
        </div>
      </section>

      {/* ── Everything else, quietly ──────────────────────────────── */}
      <section className="mb-6 rounded-xl border border-[#ece7e1] bg-[#f8f1e7] px-4 py-3">
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-widest text-[#b8b1a8]">
          The rest of the picture
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Small
            label="Taken today"
            value={money(s.revenueToday.amount)}
            note={`${s.revenueToday.count} payment${s.revenueToday.count === 1 ? "" : "s"} in`}
          />
          <Small
            label="Taken this month"
            value={money(s.revenueMonth.amount)}
            note={`${s.revenueMonth.count} payments`}
          />
          <Small label="On the rack" value={String(s.onRack)} note={`${money(s.onRackValue)} · ${s.unpaidOnRack} unpaid`} />
          <Small
            label="Turnaround"
            value={s.averageTurnaroundDays === null ? "—" : `${s.averageTurnaroundDays.toFixed(1)}d`}
            note="in to washed, 30 days"
          />
        </dl>
      </section>

      <div className="space-y-3">
        {ORDER.map((slot) => {
          // ── Who is driving where ──────────────────────────────────
          if (slot === "deliveries") {
            if (runs.length === 0) return null;
            return (
              <section
                key={slot}
                className="overflow-hidden rounded-xl border border-violet-300 bg-violet-50"
              >
                <Header
                  count={runs.reduce((n, r) => n + r.stops.length, 0)}
                  chip="bg-violet-600 text-white"
                  title="Deliveries to plan"
                  blurb="Only orders still in the shop. A stop whose washing is not finished is what keeps the van waiting."
                  value={runs.reduce((n, r) => n + r.value, 0)}
                  isOpen={!!open[slot]}
                  onClick={() => toggle(slot)}
                />
                {open[slot] && (
                  <div className="space-y-px bg-violet-200">
                    {runs.map((run) => (
                      <div key={run.day} className="bg-white px-4 py-3">
                        <p
                          className={`mb-2 flex flex-wrap items-baseline gap-x-3 rounded-lg px-3 py-2 ${
                            run.label.startsWith("Missed")
                              ? "bg-red-600 text-white"
                              : run.label === "Today"
                                ? "bg-[#26364d] text-white"
                                : "bg-[#e6dccf] text-[#26364d]"
                          }`}
                        >
                          <span className="text-lg font-black uppercase tracking-wide">
                            {run.label}
                          </span>
                          <span className="text-xs font-semibold opacity-80">{runDay(run.day)}</span>
                          <span className="text-sm font-semibold opacity-90">
                            {run.stops.length} stop{run.stops.length === 1 ? "" : "s"} ·{" "}
                            {money(run.value)}
                          </span>
                          {run.notReady > 0 && (
                            <span className="rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-red-700 sm:ml-auto">
                              {run.notReady} not washed yet
                            </span>
                          )}
                        </p>
                        {/*
                          A ruled list, not a paragraph of stops.

                          Run together with only a gap between them, three
                          deliveries read as one long sentence — worse on a
                          phone, where each stop takes two lines and the eye has
                          nothing to tell it where one ends. Every stop now sits
                          in its own ruled band, and the badges are the same
                          ones used everywhere else rather than a squashed
                          copy that happened to be typed here.
                        */}
                        <ol className="divide-y divide-[#f0e9df] overflow-hidden rounded-lg border border-[#ece7e1]">
                          {run.stops.map((o, i) => (
                            <li
                              key={o.id}
                              className="flex items-start gap-2.5 bg-white px-3 py-2.5 even:bg-[#fdfbf8]"
                            >
                              <span className="w-5 shrink-0 pt-1 text-xs font-bold text-violet-600">
                                {i + 1}.
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                  <span className="text-base font-black text-[#26364d]">
                                    {o.dueTimeLabel?.replace(/s*-s*/, "–") ?? (
                                      <span className="text-sm font-medium text-[#b8b1a8]">
                                        no time
                                      </span>
                                    )}
                                  </span>
                                  <span className="truncate font-medium text-[#26364d]">
                                    {nameOf(o)}
                                  </span>
                                  <Tags customerID={o.customerID} orderID={o.id} />
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <StateBadges o={o} />
                                  {telOf(o) && (
                                    <a
                                      href={`tel:${telOf(o)!.replace(/[^d+]/g, "")}`}
                                      className="rounded border border-[#d8cbbd] px-1.5 py-0.5 text-[11px] font-semibold text-[#546d83] hover:border-[#546d83]"
                                    >
                                      {telOf(o)}
                                    </a>
                                  )}
                                  {!o.paid && (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                      collect {money(o.total)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          }

          // ── Washing gone, money not ───────────────────────────────
          if (slot === "debts") {
            if (debts.rows.length === 0) return null;
            return (
              <section
                key={slot}
                className="overflow-hidden rounded-xl border border-rose-300 bg-rose-50"
              >
                <Header
                  count={debts.rows.length}
                  chip="bg-rose-600 text-white"
                  title="Collections pending"
                  blurb="On the pending-payment rack or already handed over, with nothing paid. Oldest first — that is the one least likely to be paid unasked."
                  value={debts.total}
                  isOpen={!!open[slot]}
                  onClick={() => toggle(slot)}
                />
                {open[slot] && (
                  <ul className="divide-y divide-rose-100 bg-white/70">
                    {debts.rows.slice(0, 60).map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                        <span className="min-w-[10rem] flex-1">
                          <span className="block text-sm font-semibold text-[#26364d]">
                            {nameOf(o)}
                            <Tags customerID={o.customerID} orderID={o.id} />
                          </span>
                          <span className="block truncate text-xs text-[#8a9099]">
                            {o.summary || `${o.pieces} pieces`}
                            {o.rack && ` · rack ${o.rack}`}
                          </span>
                        </span>
                        {o.daysOwing !== null && (
                          <span className="shrink-0 text-xs font-semibold text-rose-700">
                            {o.daysOwing === 0 ? "today" : `${o.daysOwing} days owing`}
                          </span>
                        )}
                        {telOf(o) && (
                          <a
                            href={`tel:${telOf(o)}`}
                            className="shrink-0 rounded border border-rose-300 px-2 py-0.5 text-xs font-semibold text-rose-700"
                          >
                            {telOf(o)}
                          </a>
                        )}
                        <span className="w-20 shrink-0 text-right text-sm font-bold text-[#26364d]">
                          {money(o.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          }

          // ── A band of the wash queue ──────────────────────────────
          const key = slot as Urgency;
          const band = BANDS[key];
          const rows = board.groups[key];
          const isOpen = !!open[slot];

          return (
            <section key={slot} className={`overflow-hidden rounded-xl border ${band.ring}`}>
              <Header
                count={rows.length}
                chip={band.chip}
                title={band.title}
                blurb={band.blurb}
                value={rows.reduce((sum, o) => sum + o.total, 0)}
                isOpen={isOpen}
                onClick={() => toggle(slot)}
              />
              {isOpen && (
                <div className="border-t border-white/60 bg-white/70">
                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-center text-sm text-[#8a9099]">Nothing here.</p>
                  ) : (
                    <ul className="divide-y divide-[#f0e9df]">
                      {rows.slice(0, 80).map((o) => (
                        <li key={o.id}>
                          <button
                            onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                            className="flex w-full items-start gap-x-3 px-4 py-2.5 text-left hover:bg-white"
                          >
                            <span className={`h-9 w-1 shrink-0 rounded ${band.bar}`} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm font-semibold text-[#26364d]">
                                {nameOf(o)}
                                {o.isDelivery && (
                                  <span
                                    title="Delivered by the van"
                                    className="rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-700"
                                  >
                                    VAN
                                  </span>
                                )}
                                <Tags customerID={o.customerID} orderID={o.id} />
                              </span>
                              <span className="block truncate text-xs text-[#8a9099]">
                                {o.summary || `${o.pieces} pieces`}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                                <StateBadges o={o} />
                                <span className="text-xs font-black text-[#26364d]">
                                  {whenLabel(o)}
                                </span>
                                {!o.paid && <UnpaidBadge />}
                                <span className="ml-auto text-sm font-bold text-[#26364d]">
                                  {money(o.total)}
                                </span>
                              </span>
                            </span>
                            <span className="hidden shrink-0 items-center gap-1 sm:flex">
                              <StateBadges o={o} />
                            </span>
                            <span className="hidden shrink-0 text-sm font-black text-[#26364d] sm:block">
                              {whenLabel(o)}
                            </span>
                            {key === "ready" && o.daysOnRack !== null && (
                              <span className="hidden shrink-0 rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 sm:block">
                                {o.daysOnRack === 0 ? "today" : `${o.daysOnRack}d on rack`}
                              </span>
                            )}
                            {!o.paid && (
                              <span className="hidden shrink-0 sm:block">
                                <UnpaidBadge />
                              </span>
                            )}
                            <span className="hidden w-20 shrink-0 text-right text-sm font-bold text-[#26364d] sm:block">
                              {money(o.total)}
                            </span>
                          </button>
                          {expanded === o.id && <Detail o={o} name={nameOf(o)} tel={telOf(o)} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {rows.length > 80 && (
                    <p className="px-4 py-2 text-xs text-[#8a9099]">Showing 80 of {rows.length}.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-[#b8b1a8]">
        Orders taken in between {board.windowFrom} and {board.windowTo}, read live from
        CleanCloud each time this page loads. Dates and hours are the shop&rsquo;s own —
        Oman time, not the server&rsquo;s.
      </p>
    </main>
  );
}

/**
 * The two numbers that identify a row.
 *
 * The customer number first, because names repeat and the shop recognises
 * some people by their number; the order number after it, smaller, since it
 * is what CleanCloud calls the job rather than what anybody says out loud.
 */
/**
 * Where the van is, and how long since anyone heard.
 *
 * The hard part of a delivery round is not what the driver reports — it is the
 * stretch where he reports nothing. So this panel is built to be useful when
 * it is empty of driver input: the promised hours are known and so is the
 * clock, which is enough to say "three were due by eight and nothing has been
 * marked" without him touching a thing.
 *
 * Silence is shown as a figure rather than left as blank space.
 */
function OnTheRoad({
  delivery,
  runs,
  nameOf,
}: {
  delivery: DeliveryView;
  runs: Run[];
  nameOf: (o: { customerID: string; customerName?: string | null }) => string;
}) {
  const { status, concerns } = delivery;
  const total =
    status.outCount + status.deliveredCount + status.failedCount + status.waitingCount;
  if (total === 0) return null;

  const clock = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  const stops = runs.flatMap((r) => r.stops);
  const outNow = stops.filter((o) => delivery.states[o.id]?.state === "onTheWay");

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#ece7e1] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#f0e9df] px-4 py-3">
        <p className="text-sm font-bold uppercase tracking-widest text-[#26364d]">
          The van
          <span className="ml-2 font-medium normal-case tracking-normal text-[#8a9099]">
            {status.startedAt
              ? `left at ${clock(status.startedAt)}`
              : "has not been marked as leaving"}
          </span>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-4 text-sm">
          <Tally n={status.deliveredCount} label="delivered" tone="text-emerald-700" />
          <Tally n={status.outCount} label="in the van" tone="text-[#26364d]" />
          <Tally n={status.waitingCount} label="still in the shop" tone="text-[#8a9099]" />
          {status.failedCount > 0 && (
            <Tally n={status.failedCount} label="could not deliver" tone="text-red-700" />
          )}
        </p>
      </div>

      {concerns.map((c, i) => (
        <p
          key={i}
          className={`border-b px-4 py-2.5 text-sm ${
            c.level === "urgent"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span className="font-bold">{c.headline}.</span> {c.detail}
          {c.orderIds.length > 0 && (
            <span className="ml-1 font-mono text-xs">
              {c.orderIds.map((id) => `#${id}`).join(" ")}
            </span>
          )}
        </p>
      ))}

      {outNow.length > 0 && (
        <ul className="divide-y divide-[#f0e9df]">
          {outNow.map((o) => {
            const p = delivery.states[o.id];
            return (
              <li key={o.id} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2 text-sm">
                <span className="rounded bg-[#26364d] px-1.5 text-xs font-bold text-white">
                  #{o.id}
                </span>
                <span className="font-medium text-[#26364d]">{nameOf(o)}</span>
                <span className="text-xs text-[#8a9099]">
                  out since {clock(p?.leftAt ?? null)} · promised {o.dueTimeLabel ?? "no time"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-4 py-2 text-xs text-[#8a9099]">
        {status.lastHeardAt
          ? `Last heard from the driver ${status.silentForMinutes} minutes ago, at ${clock(status.lastHeardAt)}.`
          : "Nothing has been marked on the driver's phone today."}
        {!delivery.ready && ` ${delivery.problem}`}
      </p>
    </section>
  );
}

function Tally({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className={tone}>
      <span className="text-lg font-black tabular-nums">{n}</span>{" "}
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </span>
  );
}

/** How this period stands against the last one, in a word and a colour. */
function Delta({ now, then }: { now: number; then: number }) {
  if (then <= 0) return null;
  const percent = ((now - then) / then) * 100;
  const up = percent >= 0;
  return (
    <span className={`font-bold ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(percent).toFixed(0)}%
    </span>
  );
}

/** Ready, washing or collected — said the same way wherever it appears. */
function StateBadges({ o }: { o: Assessed }) {
  return (
    <>
      {o.status === "2" ? (
        <span className="rounded bg-[#ece7e1] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#8a9099]">
          Collected
        </span>
      ) : o.cleaned ? (
        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          Ready
        </span>
      ) : (
        <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          Washing
        </span>
      )}
      {o.rack && (
        <span className="rounded border border-[#26364d] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#26364d]">
          Rack {o.rack}
        </span>
      )}
    </>
  );
}

function UnpaidBadge() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
      unpaid
    </span>
  );
}

function Tags({ customerID, orderID }: { customerID: string; orderID: string }) {
  return (
    <span className="ml-1.5 inline-flex shrink-0 items-baseline gap-1 font-mono text-xs font-normal">
      <span className="rounded bg-[#f0e9df] px-1 text-[#546d83]">c{customerID}</span>
      <span className="rounded bg-[#26364d] px-1.5 text-sm font-bold text-white">#{orderID}</span>
    </span>
  );
}

/** Every section folds to its count and its total. */
function Header({
  count,
  chip,
  title,
  blurb,
  value,
  isOpen,
  onClick,
}: {
  count: number;
  chip: string;
  title: string;
  blurb: string;
  value: number;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left">
      <span
        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold ${chip}`}
      >
        {count}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-[#26364d]">{title}</span>
        <span className="block text-xs text-[#546d83]">{blurb}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-[#26364d]">{money(value)}</span>
        <span className="text-xs text-[#8a9099]">{isOpen ? "hide" : "show"}</span>
      </span>
    </button>
  );
}

/** What is actually in the bag, shown only when somebody asks for it. */
function Detail({ o, name, tel }: { o: Assessed; name: string; tel: string | null }) {
  const rows: [string, string][] = [
    ["Customer", name],
    ["Contents", o.summary || "not itemised"],
    ["Pieces", String(o.pieces || "—")],
    ["Taken in", o.createdAt ? o.createdAt.toLocaleString() : "—"],
    ["Washed", o.cleanedAt ? o.cleanedAt.toLocaleString() : "not yet"],
    ["Promised", `${o.dueAt ? o.dueAt.toLocaleDateString() : "—"} ${o.dueTimeLabel ?? ""}`.trim()],
    ["How it goes back", o.isDelivery ? "Delivered by the van" : "Customer collects"],
    ["Total", `${money(o.total)}${o.tax ? ` (incl. tax ${money(o.tax)})` : ""}`],
    ["Paid", o.paid ? "yes" : "NO"],
  ];
  if (tel) rows.push(["Phone", tel]);
  if (o.notes) rows.push(["Notes", o.notes]);

  return (
    <div className="border-t border-[#f0e9df] bg-[#f8f1e7] px-4 py-3">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-[#b8b1a8]">{k}</dt>
            <dd className="min-w-0 flex-1 text-[#3f4f61]">{v}</dd>
          </div>
        ))}
      </dl>
      {o.receiptUrl && (
        <a
          href={o.receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-sky-700 hover:underline"
        >
          Open the full receipt in CleanCloud →
        </a>
      )}
    </div>
  );
}

/** Context, set deliberately small so it never competes with the top. */
function Small({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-[#b8b1a8]">
        {label}
      </dt>
      <dd className="text-lg font-bold leading-tight text-[#3f4f61]">{value}</dd>
      <dd className="text-[0.7rem] text-[#8a9099]">{note}</dd>
    </div>
  );
}
