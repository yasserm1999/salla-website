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

      {/* ── The whole shop in one line of numbers ─────────────────── */}
      <section className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Late" value={s.late} tone={s.late > 0 ? "bad" : "good"} note="not washed, past due" />
        <Stat label="Due today" value={s.dueToday} tone={s.dueToday > 0 ? "warn" : "plain"} note="to finish before closing" />
        <Stat label="Taken in today" value={s.takenInToday} tone="plain" note="new orders" />
        <Stat label="Driving today" value={s.drivingToday} tone={s.drivingToday > 0 ? "warn" : "plain"} note="stops on the van" />
        <Stat
          label="Sold today"
          value={money(s.salesToday.amount)}
          tone="plain"
          note={`${s.salesToday.count} orders written`}
        />
        <Stat
          label="Taken today"
          value={money(s.revenueToday.amount)}
          tone="good"
          note={`${s.revenueToday.count} payments in`}
        />
        <Stat
          label="Sold this month"
          value={money(s.salesMonth.amount)}
          tone="plain"
          note={`${s.salesMonth.count} orders written`}
        />
        <Stat
          label="Taken this month"
          value={money(s.revenueMonth.amount)}
          tone="good"
          note={`${s.revenueMonth.count} payments in`}
        />
        <Stat label="On the rack" value={s.onRack} tone="plain" note={`${money(s.onRackValue)} · ${s.unpaidOnRack} unpaid`} />
        <Stat
          label="Turnaround"
          value={s.averageTurnaroundDays === null ? "—" : `${s.averageTurnaroundDays.toFixed(1)}d`}
          tone="plain"
          note="in to washed, last 30 days"
        />
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

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone: "bad" | "warn" | "good" | "plain";
}) {
  const colour = {
    bad: "border-red-300 bg-red-50 text-red-700",
    warn: "border-amber-300 bg-amber-50 text-amber-800",
    good: "border-emerald-300 bg-emerald-50 text-emerald-700",
    plain: "border-slate-200 bg-white text-slate-900",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${colour}`}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[0.7rem] opacity-75">{note}</p>
    </div>
  );
}
