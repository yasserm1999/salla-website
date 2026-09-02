"use client";

import Link from "next/link";
import { useState } from "react";
import type { DayLine, LikeForLike, Period, Weekday } from "@/lib/revenue";

/**
 * Revenue, drawn rather than tabulated.
 *
 * The shop's headline number is what was written up at the counter, and three
 * things sit between that and what it actually earned: the owners' own
 * laundry, the carpet contractor, and the fact that July was three weeks long.
 * Each is a subtraction somebody could disagree with, so none of them is
 * folded into a total — but a column of figures buries the shape of the thing,
 * and the shape is the point. A month of trading has a rhythm to it: weekends,
 * a good Wednesday, a week the shop was quiet. That reads off a calendar in a
 * second and off a list of thirty-one rows never.
 *
 * Everything here is drawn with div widths and heights rather than a chart
 * library. At this size that is not a compromise: it reflows, it prints, and
 * it needs nothing loaded before the numbers appear.
 */

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const round = (n: number) => Math.round(n).toLocaleString();

const asDate = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`));

const dayLabel = (day: string) =>
  asDate(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function Revenue({
  periods,
  comparison,
  weekdays,
  admin,
}: {
  periods: Period[];
  comparison: LikeForLike | null;
  weekdays: Weekday[];
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

  const previous = periods.length > 1 ? periods[periods.length - 2] : null;
  const everyDay = periods.flatMap((p) => p.days);
  const lifetime = periods.reduce((s, p) => s + p.net, 0);
  const lifetimeOrders = periods.reduce((s, p) => s + p.orders, 0);
  const tradedDays = everyDay.filter((d) => d.orders > 0).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Revenue</h1>
          <p className="text-sm text-[#8a9099]">Every day the shop has traded</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
        >
          ← Shop dashboard
        </Link>
      </header>

      {/* ── The whole life of the shop, in one line ────────────────── */}
      <section className="mb-7 overflow-hidden rounded-2xl bg-[#26364d] text-white">
        {/*
          The two figures a shopkeeper actually wants side by side: where this
          month stands, and what the last one came to — with the same two months
          drawn against each other underneath, a date at a time.
        */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pb-4 pt-5">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#d8b98a]">
              {current.label} to date
            </p>
            <p className="mt-1 text-5xl font-black leading-none tracking-tight">
              {money(current.net)}
            </p>
            <p className="mt-1.5 text-sm text-[#b6c0cc]">
              {current.calendarDays} day{current.calendarDays === 1 ? "" : "s"} in ·{" "}
              {current.orders} orders · {money(current.dailyAverage)} a day
            </p>
          </div>

          {previous && (
            <div className="sm:text-right">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8fa0b3]">
                {previous.label}, the whole month
              </p>
              <p className="mt-1 text-4xl font-black leading-none tracking-tight text-[#d8b98a]">
                {money(previous.net)}
              </p>
              <p className="mt-1.5 text-sm text-[#b6c0cc]">
                {previous.calendarDays} days · {previous.orders} orders ·{" "}
                {money(previous.dailyAverage)} a day
              </p>
              {comparison && (
                <p
                  className={`mt-1 text-xs font-bold ${
                    comparison.change >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {comparison.change >= 0 ? "▲" : "▼"} {money(Math.abs(comparison.change))} on its
                  first {comparison.daysIn} days
                  {comparison.percent !== null &&
                    ` (${comparison.change >= 0 ? "+" : "−"}${Math.abs(comparison.percent).toFixed(0)}%)`}
                </p>
              )}
            </div>
          )}
        </div>
        <DayVersusDay current={current} previous={previous} />
      </section>

      {/* ── Where the month's money goes ───────────────────────────── */}
      <section className="mb-7 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-[#ece7e1] bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#26364d]">
            {current.label} — what the counter took, and what the shop keeps
          </h2>
          <p className="mb-4 text-xs text-[#8a9099]">
            {current.note === "so far" ? `${current.calendarDays} days in` : "from the 9th"} ·
            everything written up, and every slice that is not income
          </p>
          <Composition period={current} />
          <Chain period={current} />
        </div>

        {comparison && <Faceoff comparison={comparison} periods={periods} />}
      </section>

      {/* ── The months against each other ──────────────────────────── */}
      <section className="mb-7">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Month against month
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {periods
            .slice()
            .reverse()
            .map((p) => (
              <MonthCard key={p.key} period={p} best={Math.max(...periods.map((x) => x.net))} />
            ))}
        </div>
      </section>

      {/* ── Which day of the week earns its keep ───────────────────── */}
      <section className="mb-7">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Which day of the week earns its keep
        </h2>
        <p className="mb-3 text-xs text-[#8a9099]">
          Every period since opening, measured per day the shop actually opened — six good Fridays
          out of eight should not be marked down for the two it was shut.
        </p>
        <WeekShape weekdays={weekdays} />
      </section>

      {/* ── Which days beat the average ────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#26364d]">
            Every day against that month&rsquo;s average
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {periods
              .slice()
              .reverse()
              .map((p) => (
                <button
                  key={p.key}
                  onClick={() => setOpen(p.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                    open === p.key
                      ? "bg-[#26364d] text-white"
                      : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>

        {periods
          .filter((p) => p.key === open)
          .map((p) => (
            <MonthDetail key={p.key} period={p} />
          ))}
      </section>

      <p className="text-xs text-[#b8b1a8]">
        Since opening on 9 July the shop has earned{" "}
        <span className="font-bold text-[#546d83]">{money(lifetime)}</span> from {lifetimeOrders}{" "}
        customer orders over {tradedDays}{" "}
        trading days. Sales are counted the day an order is
        written up, not the day it is paid; the owners&rsquo; own accounts (c1, c6) and the carpet
        contractor&rsquo;s share are taken out throughout — signed in as {admin}
      </p>
    </main>
  );
}

/**
 * The week as a shape.
 *
 * A laundry's week is not flat — people bring washing before the weekend and
 * collect after it — and knowing which day carries the shop is what staffing
 * and opening hours turn on. Bars are drawn against the busiest day so the
 * difference between a Wednesday and a Friday is a height, not a subtraction.
 */
function WeekShape({ weekdays }: { weekdays: Weekday[] }) {
  const peak = Math.max(...weekdays.map((w) => w.average), 0.01);
  const busiest = weekdays.reduce((a, b) => (b.average > a.average ? b : a));
  const quietest = weekdays
    .filter((w) => w.tradingDays > 0)
    .reduce((a, b) => (b.average < a.average ? b : a), weekdays[0]);

  return (
    <div className="rounded-2xl border border-[#ece7e1] bg-white p-4">
      <div className="flex items-end gap-1.5 sm:gap-3">
        {weekdays.map((w) => {
          const top = w.tradingDays > 0 ? Math.max(6, (w.average / peak) * 100) : 0;
          const isBest = w.index === busiest.index && w.tradingDays > 0;
          return (
            <div key={w.index} className="flex min-w-0 flex-1 flex-col items-center">
              <span className="mb-1 text-[0.68rem] font-black tabular-nums text-[#26364d]">
                {w.tradingDays ? round(w.average) : "—"}
              </span>
              <span className="flex h-32 w-full items-end">
                <span
                  className={`w-full rounded-t-md ${
                    isBest ? "bg-[#26364d]" : w.tradingDays ? "bg-[#7aa6b8]" : "bg-[#f0e9df]"
                  }`}
                  style={{ height: `${top}%` }}
                  title={`${w.name}: ${money(w.average)} on average across ${w.tradingDays} days`}
                />
              </span>
              <span className="mt-1.5 w-full border-t border-[#f0e9df] pt-1.5 text-center text-[0.65rem] font-bold uppercase tracking-wider text-[#546d83]">
                {w.name.slice(0, 3)}
              </span>
              <span
                className={`text-[0.6rem] font-bold tabular-nums ${
                  w.tradingDays === 0
                    ? "text-[#d8cbbd]"
                    : w.vsAverage >= 0
                      ? "text-emerald-600"
                      : "text-[#b9925d]"
                }`}
              >
                {w.tradingDays === 0
                  ? "never open"
                  : `${w.vsAverage >= 0 ? "+" : "−"}${Math.abs(w.vsAverage).toFixed(0)}%`}
              </span>
              <span className="text-[0.58rem] text-[#b8b1a8]">{w.orders} orders</span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 border-t border-[#f0e9df] pt-2.5 text-xs text-[#546d83]">
        <strong className="text-[#26364d]">{busiest.name}</strong> is the shop&rsquo;s best day at{" "}
        {money(busiest.average)} a time
        {quietest.index !== busiest.index && (
          <>
            ; <strong className="text-[#26364d]">{quietest.name}</strong> the quietest at{" "}
            {money(quietest.average)}
          </>
        )}
        . Percentages are against the average trading day.
      </p>
    </div>
  );
}

/**
 * This month against the last, a day at a time.
 *
 * The same date in two months is the only fair daily comparison a shop has:
 * the 15th against the 15th, with whatever weekday and whatever weather each
 * happened to bring. Last month is drawn as a wide muted bar and this month
 * sits in front of it, so beating the day is a bar that overtops its backdrop
 * and falling short is one that does not.
 *
 * Days that have not happened yet still show last month's bar. That is the
 * point of it — what is left to beat.
 */
function DayVersusDay({
  current,
  previous,
}: {
  current: Period;
  previous: Period | null;
}) {
  const dayOf = (d: DayLine) => Number(d.day.slice(8));
  const currentBy = new Map(current.days.map((d) => [dayOf(d), d]));
  const previousBy = new Map((previous?.days ?? []).map((d) => [dayOf(d), d]));

  const lastSlot = Math.max(0, ...currentBy.keys(), ...previousBy.keys());
  const slots = Array.from({ length: lastSlot }, (_, i) => i + 1);
  const peak = Math.max(
    ...[...currentBy.values(), ...previousBy.values()].map((d) => d.net),
    0.01
  );

  const ahead = slots.filter((n) => {
    const c = currentBy.get(n);
    const b = previousBy.get(n);
    return c && c.orders > 0 && (!b || c.net > b.net);
  }).length;
  const played = slots.filter((n) => currentBy.get(n)?.orders).length;

  return (
    <div>
      <div className="flex items-end gap-px px-5" style={{ height: "7rem" }}>
        {slots.map((n) => {
          const c = currentBy.get(n);
          const b = previousBy.get(n);
          const beat = c && b ? c.net > b.net : undefined;
          return (
            <span key={n} className="relative flex h-full min-w-0 flex-1 items-end">
              {/* Last month, behind. */}
              {b && (
                <span
                  className="absolute inset-x-0 bottom-0 rounded-t-sm bg-[#4a5f7a]"
                  style={{ height: `${Math.max(1, (b.net / peak) * 100)}%` }}
                  title={`${previous!.label} ${n} — ${b.orders ? money(b.net) : "shut"}`}
                />
              )}
              {/* This month, in front and narrower so the one behind reads. */}
              {c && (
                <span
                  className={`absolute bottom-0 left-1/2 w-[58%] -translate-x-1/2 rounded-t-sm ${
                    c.orders === 0
                      ? "bg-[#33455c]"
                      : beat === false
                        ? "bg-[#d8b98a]"
                        : "bg-[#7fd6b0]"
                  }`}
                  style={{ height: `${Math.max(c.orders ? 2 : 0, (c.net / peak) * 100)}%` }}
                  title={`${current.label} ${n} — ${c.orders ? money(c.net) : "shut"}`}
                />
              )}
            </span>
          );
        })}
      </div>

      {/* A date every five days is enough to find your place. */}
      <div className="flex gap-px px-5 pt-1">
        {slots.map((n) => (
          <span
            key={n}
            className="min-w-0 flex-1 text-center text-[0.55rem] font-semibold text-[#6b7d92]"
          >
            {n === 1 || n % 5 === 0 ? n : ""}
          </span>
        ))}
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#3a4a60] px-5 py-2 text-xs text-[#8fa0b3]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#7fd6b0]" /> {current.label}, ahead
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#d8b98a]" /> {current.label}, behind
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#4a5f7a]" /> {previous?.label ?? "last month"}
        </span>
        {previous && played > 0 && (
          <span className="ml-auto font-semibold text-[#b6c0cc]">
            Beaten on {ahead} of {played} day{played === 1 ? "" : "s"} so far
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * One bar, cut into what the shop keeps and what it never had.
 *
 * A chain of figures tells you the answer; this tells you the proportion,
 * which is the thing worth knowing at a glance — a carpet-heavy month looks
 * different here long before the total does.
 */
function Composition({ period: p }: { period: Period }) {
  const gross = Math.max(p.grossSales, 0.01);
  const slice = (n: number) => `${(n / gross) * 100}%`;

  return (
    <div>
      <div className="flex h-11 overflow-hidden rounded-lg">
        <span
          className="flex items-center justify-center bg-emerald-600 text-xs font-black text-white"
          style={{ width: slice(p.net) }}
          title={`Net ${money(p.net)}`}
        >
          {p.net / gross > 0.25 && "NET"}
        </span>
        {p.carpetCost > 0 && (
          <span
            className="flex items-center justify-center bg-rose-400 text-[10px] font-black text-white"
            style={{ width: slice(p.carpetCost) }}
            title={`Carpet contractor ${money(p.carpetCost)}`}
          >
            {p.carpetCost / gross > 0.12 && "CARPETS"}
          </span>
        )}
        {p.houseSales > 0 && (
          <span
            className="flex items-center justify-center bg-[#b8b1a8] text-[10px] font-black text-white"
            style={{ width: slice(p.houseSales) }}
            title={`Owners' own laundry ${money(p.houseSales)}`}
          >
            {p.houseSales / gross > 0.12 && "OWNERS"}
          </span>
        )}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] font-semibold uppercase tracking-wider">
        <Key colour="bg-emerald-600" label={`Net ${money(p.net)}`} />
        <Key colour="bg-rose-400" label={`Carpets ${money(p.carpetCost)}`} />
        <Key colour="bg-[#b8b1a8]" label={`Owners ${money(p.houseSales)}`} />
      </p>
    </div>
  );
}

function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[#546d83]">
      <span className={`h-2.5 w-2.5 rounded-sm ${colour}`} />
      {label}
    </span>
  );
}

/** The same subtraction as the bar above, said in figures for the record. */
function Chain({ period: p }: { period: Period }) {
  return (
    <dl className="mt-4 border-t border-[#f0e9df] pt-3 text-sm">
      <Line label="Written up at the counter" note={`${p.orders + p.houseOrders} orders`} value={p.grossSales} />
      <Line
        label="The owners’ own laundry"
        note={p.houseOrders ? `${p.houseOrders} orders on c1 and c6` : "none this month"}
        value={-p.houseSales}
      />
      <Line
        label="The carpet contractor"
        note={p.carpetMetres > 0 ? `${p.carpetMetres.toFixed(2)} m² sent out` : "no carpets"}
        value={-p.carpetCost}
      />
      <div className="mt-1 flex items-baseline justify-between border-t-2 border-[#26364d] pt-2">
        <dt className="text-sm font-black uppercase tracking-widest text-[#26364d]">Net</dt>
        <dd className="text-2xl font-black tabular-nums text-emerald-700">{money(p.net)}</dd>
      </div>
    </dl>
  );
}

function Line({ label, note, value }: { label: string; note: string; value: number }) {
  const negative = value < 0;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-[#546d83]">
        {label}
        <span className="ml-2 text-xs text-[#b8b1a8]">{note}</span>
      </dt>
      <dd className={`shrink-0 tabular-nums ${negative ? "text-rose-600" : "font-semibold text-[#26364d]"}`}>
        {negative && value !== 0 ? "−" : ""}
        {money(Math.abs(value))}
      </dd>
    </div>
  );
}

/**
 * This month against the same stretch of the last one.
 *
 * Two bars on the same scale, because "down 34%" means nothing until you can
 * see how much of the month is left to make it up in.
 */
function Faceoff({ comparison: c, periods }: { comparison: LikeForLike; periods: Period[] }) {
  const peak = Math.max(c.thisMonth, c.lastMonth, 0.01);
  const up = c.change >= 0;
  const previous = periods[periods.length - 2];
  const current = periods[periods.length - 1];

  return (
    <div className="flex flex-col rounded-2xl border border-[#ece7e1] bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-[#26364d]">
        The same stretch, last month
      </h2>
      <p className="mb-4 text-xs text-[#8a9099]">
        A part-month against a finished one says nothing, so this is the first {c.daysIn} days of
        each.
      </p>

      <div className="space-y-3">
        <Race
          label={`${current.label} 1–${c.daysIn}`}
          value={c.thisMonth}
          width={(c.thisMonth / peak) * 100}
          colour="bg-[#26364d]"
        />
        <Race
          label={`${previous.label} 1–${c.daysIn}`}
          value={c.lastMonth}
          width={(c.lastMonth / peak) * 100}
          colour="bg-[#d8cbbd]"
          quiet
        />
      </div>

      <div
        className={`mt-auto flex items-baseline gap-2 border-t border-[#f0e9df] pt-3 ${
          up ? "text-emerald-700" : "text-red-700"
        }`}
      >
        <span className="text-3xl font-black leading-none">{up ? "▲" : "▼"}</span>
        <span className="text-3xl font-black tabular-nums leading-none">
          {money(Math.abs(c.change))}
        </span>
        {c.percent !== null && (
          <span className="text-lg font-bold">
            {up ? "+" : "−"}
            {Math.abs(c.percent).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Race({
  label,
  value,
  width,
  colour,
  quiet = false,
}: {
  label: string;
  value: number;
  width: number;
  colour: string;
  quiet?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 flex items-baseline justify-between text-xs">
        <span className={quiet ? "text-[#b8b1a8]" : "font-semibold text-[#546d83]"}>{label}</span>
        <span className={`font-bold tabular-nums ${quiet ? "text-[#8a9099]" : "text-[#26364d]"}`}>
          {money(value)}
        </span>
      </p>
      <span className="block h-3 rounded bg-[#f0e9df]">
        <span
          className={`block h-3 rounded ${colour}`}
          style={{ width: `${Math.max(1, width)}%` }}
        />
      </span>
    </div>
  );
}

function MonthCard({ period: p, best }: { period: Period; best: number }) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        p.isCurrent ? "border-[#26364d] bg-[#f8f1e7]" : "border-[#ece7e1] bg-white"
      }`}
    >
      <p className="flex items-baseline justify-between">
        <span className="text-lg font-black uppercase tracking-wide text-[#26364d]">{p.label}</span>
        <span className="text-xs font-semibold text-[#b8b1a8]">
          {p.note === "so far"
            ? `${p.calendarDays} days in`
            : p.note
              ? "from the 9th"
              : `${p.calendarDays} days`}
        </span>
      </p>

      <p className="mt-1 text-3xl font-black tabular-nums text-[#26364d]">{money(p.net)}</p>

      <span className="mt-2 block h-1.5 rounded bg-[#f0e9df]">
        <span
          className={`block h-1.5 rounded ${p.isCurrent ? "bg-[#d8b98a]" : "bg-[#546d83]"}`}
          style={{ width: `${Math.max(2, (p.net / Math.max(best, 0.01)) * 100)}%` }}
        />
      </span>

      <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
        <Cell label="A day" value={money(p.dailyAverage)} />
        <Cell label="Orders" value={String(p.orders)} />
        <Cell label="Best day" value={p.best ? money(p.best.net) : "—"} note={p.best ? dayLabel(p.best.day) : undefined} />
        <Cell label="Traded" value={`${p.tradingDays}/${p.calendarDays}`} />
      </dl>
    </article>
  );
}

function Cell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-bold uppercase tracking-widest text-[#b8b1a8]">{label}</dt>
      <dd className="font-bold tabular-nums text-[#546d83]">
        {value}
        {note && <span className="ml-1 text-[0.65rem] font-medium text-[#b8b1a8]">{note}</span>}
      </dd>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The month as a calendar, coloured by how the day did.
 *
 * Thirty-one rows of figures hide the shape of a month. On a grid the weekly
 * rhythm is obvious at a glance — which is the only reason to look at days
 * individually at all.
 */
function MonthDetail({ period: p }: { period: Period }) {
  const [view, setView] = useState<"run" | "calendar">("run");
  const traded = p.days.filter((d) => d.orders > 0);
  const peak = Math.max(...traded.map((d) => d.net), 0.01);

  // Blank cells so the first day lands under its weekday.
  const lead = asDate(p.days[0].day).getUTCDay();

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-7 gap-y-2 rounded-2xl border border-[#ece7e1] bg-white px-5 py-3.5">
        <Stat label="Average day" value={money(p.dailyAverage)} />
        <Stat label="Average trading day" value={money(p.perTradingDay)} quiet />
        <Stat label="Above" value={String(p.daysAbove)} tone="good" />
        <Stat label="Below" value={String(p.daysBelow)} tone="bad" />
        {p.best && <Stat label="Best" value={money(p.best.net)} note={dayLabel(p.best.day)} />}
        {p.worst && <Stat label="Quietest" value={money(p.worst.net)} note={dayLabel(p.worst.day)} quiet />}
      </div>

      <div className="mb-3 flex gap-1.5">
        {(["run", "calendar"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              view === v
                ? "bg-[#546d83] text-white"
                : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
            }`}
          >
            {v === "run" ? "Day by day" : "Calendar"}
          </button>
        ))}
      </div>

      {view === "run" && <DayRun period={p} peak={peak} />}

      {view === "calendar" && (
      <div className="rounded-2xl border border-[#ece7e1] bg-white p-4">
        <div className="mb-1.5 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => (
            <span
              key={w}
              className="text-center text-[0.6rem] font-bold uppercase tracking-widest text-[#b8b1a8]"
            >
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} />
          ))}
          {p.days.map((d) => (
            <DayCell key={d.day} day={d} peak={peak} average={p.dailyAverage} />
          ))}
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#f0e9df] pt-3 text-[0.68rem] text-[#8a9099]">
          <Key colour="bg-emerald-500" label={`Beat ${money(p.dailyAverage)}`} />
          <Key colour="bg-[#d8b98a]" label="Fell short" />
          <Key colour="bg-[#f0e9df]" label="Shut" />
        </p>
      </div>
      )}
    </div>
  );
}

/**
 * The month as a run of days, each measured against the average.
 *
 * The bar is the day and the line is the target, so beating it is a thing you
 * see rather than a thing you work out. A day the shop was shut is marked as
 * shut, not drawn as a bad day.
 */
function DayRun({ period: p, peak }: { period: Period; peak: number }) {
  const scale = Math.max(peak, p.dailyAverage, 0.01);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ece7e1] bg-white">
      {p.days.map((d) => (
        <div
          key={d.day}
          className="flex items-center gap-3 border-b border-[#f0e9df] px-3 py-1.5 last:border-0 even:bg-[#fdfbf8]"
        >
          <span className="w-[5.5rem] shrink-0 text-xs font-semibold text-[#546d83]">
            {dayLabel(d.day)}
          </span>

          <span className="relative h-4 flex-1 rounded bg-[#f0e9df]">
            <span
              className={`absolute inset-y-0 left-0 rounded ${
                d.orders === 0 ? "" : d.aboveAverage ? "bg-emerald-500" : "bg-[#d8b98a]"
              }`}
              style={{ width: `${Math.max(0, (d.net / scale) * 100)}%` }}
            />
            <span
              className="absolute inset-y-0 w-px bg-[#26364d]"
              style={{ left: `${(p.dailyAverage / scale) * 100}%` }}
              title={`average ${money(p.dailyAverage)}`}
            />
          </span>

          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[#b8b1a8]">
            {d.orders || "—"}
          </span>
          <span
            className={`w-[4.5rem] shrink-0 text-right text-sm font-bold tabular-nums ${
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
      <p className="border-t border-[#f0e9df] px-3 py-2 text-xs text-[#8a9099]">
        Green beat the average of {money(p.dailyAverage)}, sand fell short. The dark line is the
        average itself; the middle column is orders taken.
      </p>
    </div>
  );
}

function DayCell({ day: d, peak, average }: { day: DayLine; peak: number; average: number }) {
  const shut = d.orders === 0;
  const share = shut ? 0 : Math.max(0.14, d.net / peak);

  return (
    <span
      title={`${dayLabel(d.day)} — ${shut ? "shut" : `${money(d.net)} from ${d.orders} orders`}`}
      className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-lg border p-1.5 ${
        shut
          ? "border-[#f0e9df] bg-[#faf7f2]"
          : d.aboveAverage
            ? "border-emerald-200 bg-white"
            : "border-[#ece7e1] bg-white"
      }`}
    >
      {/* The day's takings fill the cell from the bottom, so a good week is a
          row of tall blocks rather than a row of numbers to compare. */}
      {!shut && (
        <span
          className={`absolute inset-x-0 bottom-0 ${d.aboveAverage ? "bg-emerald-500/85" : "bg-[#d8b98a]/85"}`}
          style={{ height: `${share * 100}%` }}
        />
      )}
      <span
        className={`relative text-[0.6rem] font-bold ${shut ? "text-[#d8cbbd]" : "text-[#26364d]"}`}
      >
        {Number(d.day.slice(8))}
      </span>
      <span
        className={`relative text-[0.68rem] font-black tabular-nums leading-none ${
          shut ? "text-[#d8cbbd]" : d.aboveAverage ? "text-white" : "text-[#26364d]"
        }`}
      >
        {shut ? "" : round(d.net)}
      </span>
      {/* Where the average would reach, so beating it is visible per cell. */}
      {!shut && average > 0 && (
        <span
          className="absolute inset-x-0 border-t border-dashed border-[#26364d]/35"
          style={{ bottom: `${Math.min(96, (average / peak) * 100)}%` }}
        />
      )}
    </span>
  );
}

function Stat({
  label,
  value,
  note,
  quiet = false,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  quiet?: boolean;
  tone?: "good" | "bad";
}) {
  const colour =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-[#b9925d]"
        : quiet
          ? "text-[#8a9099]"
          : "text-[#26364d]";
  return (
    <div>
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#b8b1a8]">{label}</p>
      <p className={`text-xl font-black tabular-nums ${colour}`}>{value}</p>
      {note && <p className="text-[0.65rem] text-[#b8b1a8]">{note}</p>}
    </div>
  );
}
