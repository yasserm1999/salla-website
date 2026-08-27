"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Assessed, Run } from "@/lib/cleancloud";

/**
 * The round, for the person driving it.
 *
 * Read on a phone, probably one-handed, probably parked. So: one stop per
 * card, in the order the clock says to drive them, with the phone number and
 * the address as things you tap rather than things you copy out. Money to
 * collect is called out loudly, because that is the part a driver gets blamed
 * for forgetting.
 *
 * Nothing about takings, margins or debts reaches this page — the owner's
 * dashboard is never rendered for a driver, so none of it is even sent here.
 */

type Person = { name: string | null; tel: string | null; place: string | null };

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Driver({ runs, driver }: { runs: Run[]; driver: string }) {
  const router = useRouter();
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [looking, setLooking] = useState(false);

  // Every stop matters to a driver, so all of them get a name up front.
  useEffect(() => {
    const ids = [...new Set(runs.flatMap((r) => r.stops.map((s) => s.customerID)))].filter(Boolean);
    if (ids.length === 0) return;
    setLooking(true);
    fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids.slice(0, 40) }),
    })
      .then((r) => r.json())
      .then((d) => d?.people && setPeople(d.people))
      .catch(() => {
        // A round without names is still a round; the addresses carry it.
      })
      .finally(() => setLooking(false));
  }, [runs]);

  async function signOut() {
    await fetch("/api/admin", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  const today = runs.find((r) => r.label === "Today");
  const rest = runs.filter((r) => r !== today);
  const stopsToday = today?.stops.length ?? 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Deliveries</h1>
          <p className="text-sm text-slate-500">
            {driver}
            {looking && <span className="ml-2 text-slate-400">· loading names…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-100"
          >
            Refresh
          </button>
          <button
            onClick={signOut}
            className="rounded-lg px-2 py-2 text-sm text-slate-500 active:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border-2 border-slate-900 bg-slate-900 px-5 py-4 text-white">
        <p className="text-5xl font-black leading-none">{stopsToday}</p>
        <p className="mt-1.5 text-sm font-semibold uppercase tracking-widest text-slate-300">
          {stopsToday === 1 ? "stop today" : "stops today"}
        </p>
        {today && today.notReady > 0 && (
          <p className="mt-2 border-t border-slate-700 pt-2 text-sm text-amber-300">
            {today.notReady} of them {today.notReady === 1 ? "is" : "are"} still being washed — check
            before you load.
          </p>
        )}
      </section>

      {runs.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
          Nothing to deliver right now.
        </p>
      )}

      {today && <RunBlock run={today} people={people} highlight />}

      {rest.map((run) => (
        <RunBlock key={run.day} run={run} people={people} />
      ))}
    </main>
  );
}

function RunBlock({
  run,
  people,
  highlight = false,
}: {
  run: Run;
  people: Record<string, Person>;
  highlight?: boolean;
}) {
  const missed = run.label === "Missed" || run.label.startsWith("Missed");
  return (
    <section className="mb-6">
      <h2
        className={`mb-2 flex items-baseline gap-2 text-sm font-bold uppercase tracking-widest ${
          missed ? "text-red-700" : highlight ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {run.label}
        <span className="text-xs font-medium normal-case tracking-normal text-slate-400">
          {run.stops.length} {run.stops.length === 1 ? "stop" : "stops"}
        </span>
      </h2>
      <div className="space-y-2.5">
        {run.stops.map((stop) => (
          <Stop key={stop.id} stop={stop} person={people[stop.customerID]} />
        ))}
      </div>
    </section>
  );
}

function Stop({ stop, person }: { stop: Assessed; person?: Person }) {
  const name = person?.name ?? `Customer ${stop.customerID}`;
  const tel = person?.tel;
  // The address written on the order wins: it is where this parcel was
  // promised, even if the customer has since moved.
  const place = stop.address ?? person?.place ?? null;
  const owes = !stop.paid && stop.total > 0;

  return (
    <article
      className={`rounded-xl border bg-white px-4 py-3 ${
        stop.cleaned ? "border-slate-200" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">
            #{stop.id}
            {stop.dueTimeLabel && <span className="font-semibold"> · {stop.dueTimeLabel}</span>}
            {stop.pieces > 0 && <span> · {stop.pieces} pcs</span>}
          </p>
        </div>
        {owes ? (
          <div className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1.5 text-center text-white">
            <p className="text-[0.6rem] font-bold uppercase leading-none tracking-wider">Collect</p>
            <p className="text-base font-black leading-tight">{money(stop.total)}</p>
          </div>
        ) : (
          <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Paid
          </span>
        )}
      </div>

      {place ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 underline-offset-2 active:bg-slate-200"
        >
          {place}
        </a>
      ) : (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-400">
          No address on file — ring to ask.
        </p>
      )}

      {stop.notes && <p className="mt-1.5 text-xs text-slate-600">Note: {stop.notes}</p>}

      {!stop.cleaned && (
        <p className="mt-1.5 text-xs font-semibold text-amber-800">Not washed yet — do not load.</p>
      )}

      {tel && (
        <a
          href={`tel:${tel.replace(/[^\d+]/g, "")}`}
          className="mt-2 block rounded-lg border border-sky-600 px-3 py-2.5 text-center text-sm font-bold text-sky-700 active:bg-sky-50"
        >
          Call {tel}
        </a>
      )}
    </article>
  );
}
