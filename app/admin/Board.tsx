"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Assessed, Board as BoardData, Urgency } from "@/lib/cleancloud";

/**
 * The dashboard.
 *
 * Read top to bottom it answers one question — what will make us late — and
 * only then the slower ones about money sitting on the rack. The ordering is
 * the whole design: anything that puts a promise at risk is above anything
 * that merely costs.
 */

const BANDS: {
  key: Urgency;
  title: string;
  blurb: string;
  ring: string;
  chip: string;
  bar: string;
}[] = [
  {
    key: "overdue",
    title: "Late",
    blurb: "Promised before today and still here. Deal with these first.",
    ring: "border-red-300 bg-red-50",
    chip: "bg-red-600 text-white",
    bar: "bg-red-600",
  },
  {
    key: "today",
    title: "Due today",
    blurb: "Promised for today. Still keepable.",
    ring: "border-amber-300 bg-amber-50",
    chip: "bg-amber-500 text-white",
    bar: "bg-amber-500",
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
    key: "resting",
    title: "Sitting on the rack",
    blurb: "Clean, paid for or not, and nobody has come. Money standing still.",
    ring: "border-slate-300 bg-slate-50",
    chip: "bg-slate-500 text-white",
    bar: "bg-slate-400",
  },
  {
    key: "later",
    title: "Comfortably ahead",
    blurb: "Nothing to do yet.",
    ring: "border-slate-200 bg-white",
    chip: "bg-slate-200 text-slate-700",
    bar: "bg-slate-300",
  },
];

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dueLabel(o: Assessed): string {
  if (o.daysUntilDue === null) return "no promised date";
  if (o.daysUntilDue < 0) {
    const d = Math.abs(o.daysUntilDue);
    return `${d} day${d === 1 ? "" : "s"} late`;
  }
  if (o.daysUntilDue === 0) return "due today";
  if (o.daysUntilDue === 1) return "due tomorrow";
  return `due in ${o.daysUntilDue} days`;
}

export function Board({ board, admin }: { board: BoardData; admin: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<Urgency | null>("overdue");
  const [onlyUnwashed, setOnlyUnwashed] = useState(false);
  const t = board.totals;

  const filtered = useMemo(() => {
    const out = {} as Record<Urgency, Assessed[]>;
    for (const b of BANDS) {
      out[b.key] = onlyUnwashed
        ? board.groups[b.key].filter((o) => !o.cleaned)
        : board.groups[b.key];
    }
    return out;
  }, [board, onlyUnwashed]);

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
            {t.pending} orders still in the shop · read{" "}
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

      {/* ── The headline: what is at risk ─────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Headline
          label="Late"
          value={t.overdue}
          note={
            t.overdue > 0
              ? `worst is ${t.worstDaysLate} days over · ${money(t.valueOverdue)} tied up`
              : "nothing has been missed"
          }
          tone={t.overdue > 0 ? "bad" : "good"}
        />
        <Headline
          label="Due today"
          value={t.dueToday}
          note={t.notCleanedYet > 0 ? `${t.notCleanedYet} in the shop still unwashed` : "all washed"}
          tone={t.dueToday > 0 ? "warn" : "plain"}
        />
        <Headline
          label="Next two days"
          value={t.dueSoon}
          note="time to plan the day around"
          tone="plain"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-500">
          <b className="text-slate-900">{t.onRackOverWeek}</b> waiting on the rack over a week
          <span className="text-slate-400"> · {money(t.valueOnRack)} in the shop</span>
        </span>
        <span className="text-slate-500">
          <b className="text-slate-900">{t.finishedUnpaid}</b> collected but never paid
        </span>
        <label className="ml-auto flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={onlyUnwashed}
            onChange={(e) => setOnlyUnwashed(e.target.checked)}
            className="h-4 w-4 accent-sky-600"
          />
          Only what is still unwashed
        </label>
      </div>

      {/* ── The bands, worst first ────────────────────────────────── */}
      <div className="space-y-3">
        {BANDS.map((band) => {
          const rows = filtered[band.key];
          const isOpen = open === band.key;
          const value = rows.reduce((s, o) => s + o.total, 0);

          return (
            <section key={band.key} className={`overflow-hidden rounded-xl border ${band.ring}`}>
              <button
                onClick={() => setOpen(isOpen ? null : band.key)}
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

              {isOpen && rows.length > 0 && (
                <div className="border-t border-white/60 bg-white/70">
                  <ul className="divide-y divide-slate-100">
                    {rows.slice(0, 60).map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                        <span className={`h-8 w-1 shrink-0 rounded ${band.bar}`} />
                        <span className="min-w-[9rem] flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            #{o.id}
                            <span className="ml-2 font-normal text-slate-500">
                              {o.cleaned ? "washed, on the rack" : "not washed yet"}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {o.summary || o.notes || `${o.pieces} pieces`}
                            {o.rack && ` · rack ${o.rack}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-700">
                          {dueLabel(o)}
                        </span>
                        {o.daysOnRack !== null && o.daysOnRack >= 3 && (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                            {o.daysOnRack}d on rack
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
                  {rows.length > 60 && (
                    <p className="px-4 py-2 text-xs text-slate-500">
                      Showing 60 of {rows.length}.
                    </p>
                  )}
                </div>
              )}

              {isOpen && rows.length === 0 && (
                <p className="border-t border-white/60 bg-white/70 px-4 py-4 text-center text-sm text-slate-500">
                  Nothing here.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Orders created between {board.windowFrom} and {board.windowTo}. Read live from
        CleanCloud each time this page loads — nothing is copied or stored here.
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
