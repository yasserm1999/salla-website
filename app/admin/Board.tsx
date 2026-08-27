"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Assessed, Board as BoardData, Debt, Run, Summary, Urgency } from "@/lib/cleancloud";

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
    ring: "border-slate-200 bg-white",
    chip: "bg-slate-200 text-slate-700",
    bar: "bg-slate-300",
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
}: {
  board: BoardData;
  runs: Run[];
  debts: { rows: Debt[]; total: number };
  summary: Summary;
  admin: string;
}) {
  const router = useRouter();
  const s = summary;

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
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shop dashboard</h1>
          <p className="text-sm text-slate-500">
            read{" "}
            {new Date(board.generatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {looking && <span className="ml-2 text-slate-400">· fetching names…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-500 hover:text-sky-700"
          >
            Refresh
          </button>
          <button
            onClick={signOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Sign out ({admin})
          </button>
        </div>
      </header>

      {/*
        Three weights, in the order the eye should travel.

        Sales first and largest — the work written up is the shop's real
        trade, and cash follows it in on its own schedule. Then what is at
        risk, in the colours that mean risk. Payments and the rest are
        context: true, worth having, never worth looking at before those two.
      */}

      {/* ── Today's trade ─────────────────────────────────────────── */}
      <section className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-slate-900 bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sold today</p>
          <p className="mt-1 text-5xl font-black leading-none tracking-tight text-slate-900">
            {money(s.salesToday.amount)}
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            {s.salesToday.count} order{s.salesToday.count === 1 ? "" : "s"} written today
          </p>
        </div>

        <div className="rounded-2xl border-2 border-slate-900 bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Sold this month
          </p>
          <p className="mt-1 text-5xl font-black leading-none tracking-tight text-slate-900">
            {money(s.salesMonth.amount)}
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
            {s.salesMonth.count} order{s.salesMonth.count === 1 ? "" : "s"} this month
          </p>
        </div>

        <div className="rounded-2xl border-2 border-slate-300 bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Orders in today
          </p>
          <p className="mt-1 text-5xl font-black leading-none tracking-tight text-slate-900">
            {s.takenInToday}
          </p>
          <p className="mt-1.5 text-sm font-medium text-slate-500">
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
      <section className="mb-6 rounded-2xl border-2 border-slate-900 bg-slate-900 px-5 py-4 text-white">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-slate-400">
              Sold this month
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-200">
              {money(s.salesMonth.amount)}
            </p>
          </div>

          <div className="pb-1 text-2xl font-light text-slate-500">−</div>

          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-rose-300">
              Carpet contractor
            </p>
            <p className="text-2xl font-bold tabular-nums text-rose-300">
              {money(s.carpetsMonth.cost)}
            </p>
          </div>

          <div className="pb-1 text-2xl font-light text-slate-500">=</div>

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
          <p className="mt-3 border-t border-slate-700 pt-2.5 text-xs text-slate-400">
            {s.carpetsMonth.metres.toFixed(2)} m² out to the contractor ·{" "}
            {s.carpetsMonth.lines
              .map((l) => `${l.label} ${l.metres.toFixed(2)} m² = ${money(l.cost)}`)
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-3 border-t border-slate-700 pt-2.5 text-xs text-slate-400">
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
            s.dueToday > 0 ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-baseline gap-3">
            <p
              className={`text-4xl font-black leading-none ${
                s.dueToday > 0 ? "text-amber-700" : "text-slate-900"
              }`}
            >
              {s.dueToday}
            </p>
            <p
              className={`text-sm font-bold uppercase tracking-wider ${
                s.dueToday > 0 ? "text-amber-700" : "text-slate-500"
              }`}
            >
              Due today
            </p>
          </div>
          <p
            className={`mt-1 text-xs ${s.dueToday > 0 ? "text-amber-700/80" : "text-slate-500"}`}
          >
            {s.dueToday > 0 ? "to finish before the hour promised" : "nothing left for today"}
          </p>
        </div>
      </section>

      {/* ── Everything else, quietly ──────────────────────────────── */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-widest text-slate-400">
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
                        <p className="mb-1.5 flex flex-wrap items-baseline gap-2">
                          <span className="font-bold text-slate-900">{run.label}</span>
                          <span className="text-sm text-slate-500">
                            {run.stops.length} stop{run.stops.length === 1 ? "" : "s"} ·{" "}
                            {money(run.value)}
                          </span>
                          {run.notReady > 0 && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                              {run.notReady} not washed yet
                            </span>
                          )}
                        </p>
                        <ol className="space-y-1">
                          {run.stops.map((o, i) => (
                            <li key={o.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                              <span className="w-5 shrink-0 text-xs font-bold text-violet-600">
                                {i + 1}.
                              </span>
                              <span className="font-medium text-slate-900">{nameOf(o)}</span>
                              <span className="text-xs text-slate-500">
                                {o.dueTimeLabel ?? "no time"}
                              </span>
                              <Tags customerID={o.customerID} orderID={o.id} />
                              {telOf(o) && (
                                <a
                                  href={`tel:${telOf(o)}`}
                                  className="rounded border border-slate-300 px-1.5 text-xs font-semibold text-slate-600"
                                >
                                  {telOf(o)}
                                </a>
                              )}
                              {!o.cleaned && (
                                <span className="rounded bg-red-100 px-1.5 text-[11px] font-bold text-red-700">
                                  not washed
                                </span>
                              )}
                              {!o.paid && (
                                <span className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
                                  collect {money(o.total)}
                                </span>
                              )}
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
                          <span className="block text-sm font-semibold text-slate-900">
                            {nameOf(o)}
                            <Tags customerID={o.customerID} orderID={o.id} />
                          </span>
                          <span className="block truncate text-xs text-slate-500">
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
                        <span className="w-20 shrink-0 text-right text-sm font-bold text-slate-900">
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
                    <p className="px-4 py-4 text-center text-sm text-slate-500">Nothing here.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {rows.slice(0, 80).map((o) => (
                        <li key={o.id}>
                          <button
                            onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                            className="flex w-full flex-wrap items-center gap-x-3 px-4 py-2.5 text-left hover:bg-white"
                          >
                            <span className={`h-9 w-1 shrink-0 rounded ${band.bar}`} />
                            <span className="min-w-[11rem] flex-1">
                              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
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
                              <span className="block truncate text-xs text-slate-500">
                                {o.summary || `${o.pieces} pieces`}
                                {o.rack && ` · rack ${o.rack}`}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-bold text-slate-800">
                              {whenLabel(o)}
                            </span>
                            {key === "ready" && o.daysOnRack !== null && (
                              <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                                {o.daysOnRack === 0 ? "today" : `${o.daysOnRack}d on rack`}
                              </span>
                            )}
                            {!o.paid && (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                unpaid
                              </span>
                            )}
                            <span className="w-20 shrink-0 text-right text-sm font-bold text-slate-900">
                              {money(o.total)}
                            </span>
                          </button>
                          {expanded === o.id && <Detail o={o} name={nameOf(o)} tel={telOf(o)} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  {rows.length > 80 && (
                    <p className="px-4 py-2 text-xs text-slate-500">Showing 80 of {rows.length}.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
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
function Tags({ customerID, orderID }: { customerID: string; orderID: string }) {
  return (
    <span className="ml-1.5 inline-flex shrink-0 items-baseline gap-1 font-mono text-xs font-normal">
      <span className="rounded bg-slate-100 px-1 text-slate-600">c{customerID}</span>
      <span className="text-slate-400">#{orderID}</span>
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
        <span className="block font-bold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-600">{blurb}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold text-slate-900">{money(value)}</span>
        <span className="text-xs text-slate-500">{isOpen ? "hide" : "show"}</span>
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
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-slate-400">{k}</dt>
            <dd className="min-w-0 flex-1 text-slate-800">{v}</dd>
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
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="text-lg font-bold leading-tight text-slate-800">{value}</dd>
      <dd className="text-[0.7rem] text-slate-500">{note}</dd>
    </div>
  );
}
