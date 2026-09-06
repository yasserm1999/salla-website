"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Assessed, Board as BoardData, Urgency } from "@/lib/cleancloud";

/**
 * The work, for the person doing it.
 *
 * Same orders as the owner's board and the same order of urgency, with every
 * figure of money taken out — not hidden behind a toggle but never sent to the
 * browser at all, because the page that carries them is never rendered for
 * this role.
 *
 * What is left is what a washer actually acts on: what is late, what is
 * promised today, what is already done, and which rack it is on.
 */

type Person = { name: string | null; tel: string | null; place: string | null };

const ORDER: Urgency[] = ["late", "today", "tomorrow", "inTwo", "later", "ready"];

const BANDS: Record<Urgency, { title: string; blurb: string; ring: string; chip: string }> = {
  late: {
    title: "Late — still not washed",
    blurb: "Promised for a day already gone. These come first, whatever else is waiting.",
    ring: "border-red-300 bg-red-50",
    chip: "bg-red-600 text-white",
  },
  today: {
    title: "Due today",
    blurb: "Promised back today. Finish before the hour on each one.",
    ring: "border-amber-300 bg-amber-50",
    chip: "bg-amber-500 text-white",
  },
  tomorrow: {
    title: "Tomorrow",
    blurb: "Wash today if the day allows it.",
    ring: "border-sky-300 bg-sky-50",
    chip: "bg-sky-600 text-white",
  },
  inTwo: {
    title: "In two days",
    blurb: "Comfortable, but worth knowing the size of.",
    ring: "border-indigo-200 bg-indigo-50",
    chip: "bg-indigo-500 text-white",
  },
  later: {
    title: "Further out",
    blurb: "Taken in, with more than two days in hand.",
    ring: "border-[#ece7e1] bg-white",
    chip: "bg-[#e6dccf] text-[#546d83]",
  },
  ready: {
    title: "Washed — on the rack",
    blurb: "Done and waiting for the customer. Nothing here needs doing.",
    ring: "border-emerald-200 bg-emerald-50",
    chip: "bg-emerald-600 text-white",
  },
  collected: { title: "", blurb: "", ring: "", chip: "" },
};

function whenLabel(o: Assessed): string {
  const time = o.dueTimeLabel ? ` ${o.dueTimeLabel.replace(/\s*-\s*/, "–")}` : "";
  if (o.daysUntilDue === null) return "no promised date";
  if (o.daysUntilDue === 0 && o.urgency === "late") return `overdue — was due${time || " earlier"}`;
  if (o.daysUntilDue < 0) {
    const d = Math.abs(o.daysUntilDue);
    return `${d} day${d === 1 ? "" : "s"} late${time ? ` · was due${time}` : ""}`;
  }
  if (o.daysUntilDue === 0) return `today${time}`;
  if (o.daysUntilDue === 1) return `tomorrow${time}`;
  return `in ${o.daysUntilDue} days${time}`;
}

export function Work({
  board,
  worker,
}: {
  board: BoardData;
  worker: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>({ late: true, today: true });
  const [people, setPeople] = useState<Record<string, Person>>({});

  const lookUp = useCallback(async (ids: string[]) => {
    const wanted = [...new Set(ids.filter(Boolean))];
    if (wanted.length === 0) return;
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: wanted.slice(0, 40) }),
      });
      const data = await res.json();
      if (data?.people) setPeople((prev) => ({ ...prev, ...data.people }));
    } catch {
      // A bag is found by its number; the name only makes it quicker.
    }
  }, []);

  useEffect(() => {
    const showing = ORDER.filter((b) => open[b]).flatMap((b) => board.groups[b]);
    const missing = showing.map((o) => o.customerID).filter((id) => id && !(id in people));
    if (missing.length > 0) void lookUp(missing.slice(0, 40));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, board]);

  async function signOut() {
    await fetch("/api/admin", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  const nameOf = (o: Assessed) => people[o.customerID]?.name ?? `Customer ${o.customerID}`;
  const count = (b: Urgency) => board.groups[b].length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#ece7e1] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">The work</h1>
          <p className="text-sm text-[#8a9099]">
            {worker} ·{" "}
            {new Date(board.generatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/admin/issues"
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-bold text-[#546d83] hover:border-[#d8b98a]"
          >
            Report
          </a>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
          >
            Refresh
          </button>
          <button
            onClick={signOut}
            className="rounded-lg px-2 py-2 text-sm text-[#8a9099] hover:text-[#26364d]"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Counts only. There is no money anywhere on this page. */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Late" value={count("late")} tone={count("late") > 0 ? "bad" : "good"} />
        <Tile label="Due today" value={count("today")} tone={count("today") > 0 ? "warn" : "good"} />
        <Tile label="Tomorrow" value={count("tomorrow")} tone="plain" />
        <Tile label="On the rack" value={count("ready")} tone="done" />
      </section>

      <div className="space-y-3">
        {ORDER.map((slot) => {
          const band = BANDS[slot];
          const rows = board.groups[slot];
          const isOpen = !!open[slot];

          return (
            <section key={slot} className={`overflow-hidden rounded-xl border ${band.ring}`}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [slot]: !s[slot] }))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-black ${band.chip}`}
                >
                  {rows.length}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[#26364d]">{band.title}</span>
                  <span className="block text-xs text-[#8a9099]">{band.blurb}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#8a9099]">
                  {isOpen ? "hide" : "show"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-white/60 bg-white/70">
                  {rows.length === 0 ? (
                    <p className="px-4 py-4 text-center text-sm text-[#8a9099]">Nothing here.</p>
                  ) : (
                    <ul className="divide-y divide-[#f0e9df]">
                      {rows.slice(0, 80).map((o) => (
                        <li key={o.id} className="flex items-start gap-2.5 px-3 py-2.5">
                          <span className="rounded bg-[#26364d] px-1.5 py-0.5 text-sm font-bold text-white">
                            #{o.id}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold text-[#26364d]">{nameOf(o)}</span>
                              {o.isDelivery && (
                                <span className="rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-700">
                                  VAN
                                </span>
                              )}
                              <span className="text-sm font-black text-[#26364d]">
                                {whenLabel(o)}
                              </span>
                            </p>
                            <p className="truncate text-xs text-[#8a9099]">
                              {o.summary || `${o.pieces} pieces`}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5">
                              {o.cleaned ? (
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
                              {o.pieces > 0 && (
                                <span className="text-[11px] text-[#b8b1a8]">{o.pieces} pcs</span>
                              )}
                              {slot === "ready" && o.daysOnRack !== null && (
                                <span className="text-[11px] text-emerald-700">
                                  {o.daysOnRack === 0 ? "today" : `${o.daysOnRack}d on the rack`}
                                </span>
                              )}
                            </p>
                            {o.notes && (
                              <p className="mt-1 text-xs font-medium text-[#b9925d]">{o.notes}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rows.length > 80 && (
                    <p className="px-4 py-2 text-xs text-[#8a9099]">
                      and {rows.length - 80} more
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "bad" | "warn" | "good" | "done" | "plain";
}) {
  const colour = {
    bad: "border-red-300 bg-red-50 text-red-700",
    warn: "border-amber-300 bg-amber-50 text-amber-800",
    good: "border-emerald-300 bg-emerald-50 text-emerald-700",
    done: "border-emerald-200 bg-white text-emerald-700",
    plain: "border-[#ece7e1] bg-white text-[#26364d]",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${colour}`}>
      <p className="text-[0.68rem] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 text-3xl font-black leading-none">{value}</p>
    </div>
  );
}
