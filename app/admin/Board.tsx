"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Assessed, Board as BoardData, Urgency } from "@/lib/cleancloud";

/**
 * The dashboard.
 *
 * Everything above the fold is work the shop still owes. A clean bag waiting
 * on the rack is the customer's errand — it appears, with its value and how
 * long it has been there, but never above something still to be washed.
 */

const BANDS: {
  key: Urgency;
  title: string;
  blurb: string;
  ring: string;
  chip: string;
  bar: string;
  openByDefault?: boolean;
}[] = [
  {
    key: "late",
    title: "Late — still not washed",
    blurb: "Promised for a day already gone and the work is not done.",
    ring: "border-red-300 bg-red-50",
    chip: "bg-red-600 text-white",
    bar: "bg-red-600",
    openByDefault: true,
  },
  {
    key: "today",
    title: "Due today",
    blurb: "Must be washed and ready before the hour promised.",
    ring: "border-amber-300 bg-amber-50",
    chip: "bg-amber-500 text-white",
    bar: "bg-amber-500",
    openByDefault: true,
  },
  {
    key: "soon",
    title: "Next two days",
    blurb: "Close enough that a slow morning turns them late.",
    ring: "border-sky-300 bg-sky-50",
    chip: "bg-sky-600 text-white",
    bar: "bg-sky-600",
  },
  {
    key: "later",
    title: "Further out",
    blurb: "Received, with time in hand.",
    ring: "border-slate-200 bg-white",
    chip: "bg-slate-200 text-slate-700",
    bar: "bg-slate-300",
  },
  {
    key: "ready",
    title: "Washed — waiting for collection",
    blurb: "The work is done. Nothing here is the shop being late.",
    ring: "border-emerald-200 bg-emerald-50",
    chip: "bg-emerald-600 text-white",
    bar: "bg-emerald-500",
  },
];

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function whenLabel(o: Assessed): string {
  const time = o.dueTimeLabel ? ` ${o.dueTimeLabel}` : "";
  if (o.daysUntilDue === null) return "no promised date";
  if (o.daysUntilDue < 0) {
    const d = Math.abs(o.daysUntilDue);
    return `${d} day${d === 1 ? "" : "s"} late${time ? ` · was due${time}` : ""}`;
  }
  if (o.daysUntilDue === 0) return `today${time}`;
  if (o.daysUntilDue === 1) return `tomorrow${time}`;
  return `in ${o.daysUntilDue} days${time}`;
}

export function Board({ board, admin }: { board: BoardData; admin: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(BANDS.map((b) => [b.key, !!b.openByDefault]))
  );
  const t = board.totals;

  async function signOut() {
    await fetch("/api/admin", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shop dashboard</h1>
          <p className="text-sm text-slate-500">
            {t.owed} order{t.owed === 1 ? "" : "s"} still to wash · {t.ready} washed and waiting ·
            read{" "}
            {new Date(board.generatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
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

      {/* ── What the shop still owes ──────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Headline
          label="Late"
          value={t.late}
          note={
            t.late > 0
              ? `worst is ${t.worstDaysLate} day${t.worstDaysLate === 1 ? "" : "s"} over · ${money(t.valueLate)}`
              : "nothing is overdue"
          }
          tone={t.late > 0 ? "bad" : "good"}
        />
        <Headline
          label="Due today"
          value={t.dueToday}
          note={t.dueToday > 0 ? "wash before the hour promised" : "nothing promised for today"}
          tone={t.dueToday > 0 ? "warn" : "plain"}
        />
        <Headline
          label="Next two days"
          value={t.dueSoon}
          note="worth planning the day around"
          tone="plain"
        />
      </div>

      <p className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <b>{t.ready}</b> orders are washed and waiting to be collected
        {t.readyOverWeek > 0 && <> — {t.readyOverWeek} for over a week</>} ·{" "}
        {money(t.valueReady)} on the rack
        {t.unpaidReady > 0 && <>, {t.unpaidReady} of them not yet paid</>}. The work is
        done on all of these.
      </p>

      {/* ── The bands ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {BANDS.map((band) => {
          const rows = board.groups[band.key];
          const isOpen = open[band.key];
          const value = rows.reduce((s, o) => s + o.total, 0);

          return (
            <section key={band.key} className={`overflow-hidden rounded-xl border ${band.ring}`}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [band.key]: !s[band.key] }))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold ${band.chip}`}
                >
                  {rows.length}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-900">{band.title}</span>
                  <span className="block text-xs text-slate-600">{band.blurb}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-slate-900">{money(value)}</span>
                  <span className="text-xs text-slate-500">{isOpen ? "hide" : "show"}</span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/60 bg-white/70">
                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-center text-sm text-slate-500">Nothing here.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {rows.slice(0, 60).map((o) => (
                        <li
                          key={o.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                        >
                          <span className={`h-9 w-1 shrink-0 rounded ${band.bar}`} />

                          <span className="min-w-[11rem] flex-1">
                            <span className="block text-sm font-semibold text-slate-900">
                              {o.customerName ?? `Customer ${o.customerID}`}
                              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                                #{o.id}
                              </span>
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {o.summary || o.notes || `${o.pieces} pieces`}
                              {o.rack && ` · rack ${o.rack}`}
                            </span>
                          </span>

                          <span className="shrink-0 text-sm font-bold text-slate-800">
                            {whenLabel(o)}
                          </span>

                          {band.key === "ready" && o.daysOnRack !== null && (
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
                        </li>
                      ))}
                    </ul>
                  )}
                  {rows.length > 60 && (
                    <p className="px-4 py-2 text-xs text-slate-500">
                      Showing 60 of {rows.length}.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Orders created between {board.windowFrom} and {board.windowTo}, read live from
        CleanCloud each time this page loads. Customer names are fetched only for the
        orders still to be washed.
      </p>
    </main>
  );
}

function Headline({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
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
    <div className={`rounded-xl border p-4 ${colour}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-4xl font-bold leading-none">{value}</p>
      <p className="mt-1.5 text-xs opacity-80">{note}</p>
    </div>
  );
}
