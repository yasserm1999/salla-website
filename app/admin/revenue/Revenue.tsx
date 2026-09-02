"use client";

import Link from "next/link";
import { useState } from "react";
import type { LikeForLike, Period } from "@/lib/revenue";

/**
 * Revenue, with the arithmetic shown.
 *
 * The shop's headline number is what was written up at the counter, and three
 * things sit between that and what it actually earned: the owners' own
 * laundry, the carpet contractor, and the fact that July was three weeks long.
 * Every one of those is a subtraction somebody could disagree with, so each is
 * printed on its own line rather than folded into a total.
 */

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dayLabel = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export function Revenue({
  periods,
  comparison,
  admin,
}: {
  periods: Period[];
  comparison: LikeForLike | null;
  admin: string;
}) {
  const current = periods[periods.length - 1];
  const [open, setOpen] = useState<string>(current?.key ?? "");

  if (!current) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-bold text-[#26364d]">Revenue</h1>
        <p className="mt-3 text-sm text-[#8a9099]">No trading yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#ece7e1] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Revenue</h1>
          <p className="text-sm text-[#8a9099]">
            Since the shop opened, 9 July — every period side by side
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
        >
          ← Shop dashboard
        </Link>
      </header>

      {/* ── How the net is arrived at ──────────────────────────────── */}
      <section className="mb-7">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          {current.label} so far — how the net is arrived at
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
          <Working
            label="Written up at the counter"
            note={`${current.orders + current.houseOrders} orders`}
            value={current.grossSales}
          />
          <Working
            label="Less the owners' own laundry"
            note={
              current.houseOrders
                ? `${current.houseOrders} orders on c1 and c6 — real work, but not income`
                : "none this month"
            }
            value={-current.houseSales}
            deduct
          />
          <Working label="Customer sales" value={current.customerSales} subtotal />
          <Working
            label="Less the carpet contractor"
            note={
              current.carpetMetres > 0
                ? `${current.carpetMetres.toFixed(2)} m² sent out to be washed`
                : "no carpets this month"
            }
            value={-current.carpetCost}
            deduct
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2 bg-[#26364d] px-4 py-3.5 text-white">
            <span className="text-sm font-bold uppercase tracking-widest text-[#d8b98a]">
              Net to the shop
            </span>
            <span className="text-3xl font-black tabular-nums text-emerald-300">
              {money(current.net)}
            </span>
          </div>
        </div>
      </section>

      {/* ── This month against the last ────────────────────────────── */}
      {comparison && (
        <section className="mb-7 rounded-xl border border-[#ece7e1] bg-white px-4 py-3.5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
            Same stretch, last month
          </h2>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Figure label={`First ${comparison.daysIn} days, now`} value={money(comparison.thisMonth)} />
            <Figure
              label={`First ${comparison.daysIn} days, last month`}
              value={money(comparison.lastMonth)}
              quiet
            />
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-widest text-[#b8b1a8]">
                Difference
              </p>
              <p
                className={`text-2xl font-black tabular-nums ${
                  comparison.change >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {comparison.change >= 0 ? "+" : "−"}
                {money(Math.abs(comparison.change))}
                {comparison.percent !== null && (
                  <span className="ml-1.5 text-base font-bold">
                    ({comparison.change >= 0 ? "+" : "−"}
                    {Math.abs(comparison.percent).toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="mt-2 border-t border-[#f0e9df] pt-2 text-xs text-[#8a9099]">
            A part-month against a finished one says nothing, so this compares the same number of
            days into each.
          </p>
        </section>
      )}

      {/* ── Every period ───────────────────────────────────────────── */}
      <section className="mb-7">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Every period since opening
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[#ece7e1] bg-white">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-[#ece7e1] text-left text-[0.68rem] uppercase tracking-wider text-[#b8b1a8]">
                <th className="px-4 py-2.5 font-semibold">Period</th>
                <th className="px-3 py-2.5 text-right font-semibold">Written up</th>
                <th className="px-3 py-2.5 text-right font-semibold">Owners&rsquo;</th>
                <th className="px-3 py-2.5 text-right font-semibold">Carpets</th>
                <th className="px-3 py-2.5 text-right font-semibold">Net</th>
                <th className="px-3 py-2.5 text-right font-semibold">Orders</th>
                <th className="px-3 py-2.5 text-right font-semibold">A day</th>
                <th className="px-4 py-2.5 text-right font-semibold">Best day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e9df]">
              {periods.map((p) => (
                <tr key={p.key} className={p.isCurrent ? "bg-[#f8f1e7]" : ""}>
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-[#26364d]">{p.label}</span>
                    {p.note && (
                      <span className="ml-1.5 text-xs text-[#b8b1a8]">
                        {p.note === "so far" ? `— ${p.calendarDays} days so far` : "— from the 9th"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#546d83]">
                    {money(p.grossSales)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#b8b1a8]">
                    {p.houseSales > 0 ? `−${money(p.houseSales)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#b8b1a8]">
                    {p.carpetCost > 0 ? `−${money(p.carpetCost)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-black tabular-nums text-[#26364d]">
                    {money(p.net)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#546d83]">{p.orders}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#546d83]">
                    {money(p.dailyAverage)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#546d83]">
                    {p.best ? (
                      <>
                        {money(p.best.net)}
                        <span className="ml-1 text-xs text-[#b8b1a8]">
                          {dayLabel(p.best.day).slice(0, 6)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[#8a9099]">
          &ldquo;A day&rdquo; is net over every day in the period, whether the shop opened or not.
        </p>
      </section>

      {/* ── Day by day, against the average ────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Day by day, against that period&rsquo;s average
        </h2>
        <div className="flex flex-wrap gap-2">
          {periods
            .slice()
            .reverse()
            .map((p) => (
              <button
                key={p.key}
                onClick={() => setOpen(p.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  open === p.key
                    ? "bg-[#26364d] text-white"
                    : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
                }`}
              >
                {p.label}
              </button>
            ))}
        </div>

        {periods
          .filter((p) => p.key === open)
          .map((p) => (
            <DayTable key={p.key} period={p} />
          ))}
      </section>

      <p className="text-xs text-[#b8b1a8]">
        Sales are counted the day an order is written up, not the day it is paid — signed in as{" "}
        {admin}
      </p>
    </main>
  );
}

function DayTable({ period: p }: { period: Period }) {
  const peak = Math.max(...p.days.map((d) => d.net), p.dailyAverage, 1);

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-[#ece7e1] bg-white px-4 py-3">
        <Figure label="Average day" value={money(p.dailyAverage)} />
        <Figure label="Average trading day" value={money(p.perTradingDay)} quiet />
        <Figure label="Days above" value={String(p.daysAbove)} tone="good" />
        <Figure label="Days below" value={String(p.daysBelow)} tone="bad" />
        <Figure label="Traded" value={`${p.tradingDays} of ${p.calendarDays}`} quiet />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
        {p.days.map((d) => (
          <div
            key={d.day}
            className="flex items-center gap-3 border-b border-[#f0e9df] px-3 py-1.5 last:border-0"
          >
            <span className="w-24 shrink-0 text-xs font-semibold text-[#546d83]">
              {dayLabel(d.day)}
            </span>

            {/* The bar is the point; the average is the line it has to beat. */}
            <span className="relative h-4 flex-1 rounded bg-[#f0e9df]">
              <span
                className={`absolute inset-y-0 left-0 rounded ${
                  d.orders === 0
                    ? ""
                    : d.aboveAverage
                      ? "bg-emerald-500"
                      : "bg-[#d8b98a]"
                }`}
                style={{ width: `${Math.max(0, (d.net / peak) * 100)}%` }}
              />
              <span
                className="absolute inset-y-0 w-px bg-[#26364d]"
                style={{ left: `${(p.dailyAverage / peak) * 100}%` }}
                title={`average ${money(p.dailyAverage)}`}
              />
            </span>

            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-[#b8b1a8]">
              {d.orders || "—"}
            </span>
            <span
              className={`w-20 shrink-0 text-right text-sm font-bold tabular-nums ${
                d.orders === 0
                  ? "text-[#d8cbbd]"
                  : d.aboveAverage
                    ? "text-emerald-700"
                    : "text-[#8a9099]"
              }`}
            >
              {d.orders === 0 ? "shut" : money(d.net)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#8a9099]">
        Green beat the average of {money(p.dailyAverage)}, sand fell short. The dark line is the
        average itself. Middle column is orders taken.
      </p>
    </div>
  );
}

function Working({
  label,
  note,
  value,
  deduct = false,
  subtotal = false,
}: {
  label: string;
  note?: string;
  value: number;
  deduct?: boolean;
  subtotal?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-[#f0e9df] px-4 py-2.5 ${
        subtotal ? "bg-[#f8f1e7]" : ""
      }`}
    >
      <span>
        <span
          className={`text-sm ${subtotal ? "font-bold text-[#26364d]" : "font-medium text-[#546d83]"}`}
        >
          {label}
        </span>
        {note && <span className="ml-2 text-xs text-[#b8b1a8]">{note}</span>}
      </span>
      <span
        className={`text-lg font-bold tabular-nums ${
          deduct ? "text-rose-600" : "text-[#26364d]"
        }`}
      >
        {deduct && value !== 0 ? `−${money(Math.abs(value))}` : money(Math.abs(value))}
      </span>
    </div>
  );
}

function Figure({
  label,
  value,
  quiet = false,
  tone,
}: {
  label: string;
  value: string;
  quiet?: boolean;
  tone?: "good" | "bad";
}) {
  const colour = tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-[#b9925d]" : quiet ? "text-[#8a9099]" : "text-[#26364d]";
  return (
    <div>
      <p className="text-[0.68rem] font-bold uppercase tracking-widest text-[#b8b1a8]">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${colour}`}>{value}</p>
    </div>
  );
}
