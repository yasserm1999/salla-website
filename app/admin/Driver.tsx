"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Assessed, Run } from "@/lib/cleancloud";
import type { EventKind, StopState } from "@/lib/delivery";

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

/** A tap, with the moment it was made rather than the moment it was sent. */
type Pending = { orderId: string | null; kind: EventKind; reason?: string; at: string; day: string };

const QUEUE_KEY = "salla_driver_queue";

/*
  Nothing is lost to a dead signal.

  Every tap is written to the phone first and sent afterwards, carrying the
  time it was made. If the van is out of coverage the taps sit in the queue and
  go up together the moment it comes back — and because each one kept its own
  timestamp, the shop learns what really happened at 7:40 rather than a row of
  events all stamped with the moment he got a bar of signal back.
*/
function readQueue(): Pending[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Pending[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: Pending[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // A phone with no storage still works; it just cannot survive a reload.
  }
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2026-08-27" as a person says it: "Thu 27 Aug". */
function dayName(day: string): string {
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

/** "7pm-8pm" as it should be read: with a proper dash, and no shouting. */
const timeWindow = (label: string | null) => (label ? label.replace(/s*-s*/, "–") : null);

/** A collection from the shop's own book, to be done on the same trip. */
export type PickupRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  atTime: string | null;
  status: string;
  note: string | null;
};

export function Driver({
  runs,
  driver,
  today: todayYmd,
  states,
  pickups,
  storeReady,
  storeProblem,
}: {
  runs: Run[];
  driver: string;
  today: string;
  /** What the server already knows about each stop. */
  states: Record<string, StopState>;
  pickups: PickupRow[];
  storeReady: boolean;
  storeProblem: string | null;
}) {
  const router = useRouter();
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [looking, setLooking] = useState(false);

  // What this phone has recorded but the server may not have yet.
  const [queue, setQueue] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);

  const flush = useCallback(async () => {
    const items = readQueue();
    if (items.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: items }),
      });
      if (!res.ok) return; // Keep them; the next attempt will try again.
      writeQueue([]);
      setQueue([]);
      router.refresh();
    } catch {
      // No signal. The queue stays exactly where it is.
    } finally {
      setSending(false);
    }
  }, [router]);

  // Send on arrival, whenever the phone finds signal, and every half minute.
  useEffect(() => {
    setQueue(readQueue());
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void flush(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  function record(orderId: string | null, kind: EventKind, reason?: string) {
    const event: Pending = { orderId, kind, reason, at: new Date().toISOString(), day: todayYmd };
    const next = [...readQueue(), event];
    writeQueue(next);
    setQueue(next);
    void flush();
  }

  /*
    What this phone believes, which is the server's view plus anything it has
    not managed to send yet. The driver must never tap "delivered", lose
    signal, and watch the parcel reappear as undelivered.
  */
  const stateOf = (orderId: string): StopState => {
    const mine = queue.filter((q) => q.orderId === orderId);
    const last = mine[mine.length - 1];
    if (last?.kind === "delivered") return "delivered";
    if (last?.kind === "failed") return "failed";
    if (last?.kind === "on_the_way") return "onTheWay";
    return states[orderId] ?? "waiting";
  };


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

  const [pickupBusy, setPickupBusy] = useState<string | null>(null);

  async function markPickup(id: string, status: string, reason?: string) {
    setPickupBusy(id);
    try {
      await fetch("/api/admin/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "status", id, status, reason }),
      });
      router.refresh();
    } catch {
      // The queue below is for deliveries; a collection is retried by hand.
    } finally {
      setPickupBusy(null);
    }
  }

  async function signOut() {
    await fetch("/api/admin", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  const today = runs.find((r) => r.label === "Today");
  const rest = runs.filter((r) => r !== today);
  const todayStops = today?.stops ?? [];
  const stopsToday = todayStops.length;
  const done = todayStops.filter((s) => stateOf(s.id) === "delivered").length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Deliveries</h1>
          <p className="text-sm text-[#8a9099]">
            {driver}
            {looking && <span className="ml-2 text-[#b8b1a8]">· loading names…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/pickups"
            className="rounded-lg border border-sky-500 px-3 py-2 text-sm font-bold text-sky-700 active:bg-sky-50"
          >
            Pickups
          </a>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] active:bg-[#f0e9df]"
          >
            Refresh
          </button>
          <button
            onClick={signOut}
            className="rounded-lg px-2 py-2 text-sm text-[#8a9099] active:text-[#26364d]"
          >
            Sign out
          </button>
        </div>
      </header>

      {!storeReady && (
        <p className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-bold">Nothing you press is reaching the shop.</span> {storeProblem}
        </p>
      )}

      {queue.length > 0 && (
        <p className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {queue.length} update{queue.length === 1 ? "" : "s"} not sent to the shop yet
          {sending ? " — sending now…" : ". They will go by themselves once there is signal."}
        </p>
      )}

      <section className="mb-5 rounded-2xl border-2 border-[#26364d] bg-[#26364d] px-5 py-4 text-white">
        <p className="text-5xl font-black leading-none">{stopsToday}</p>
        <p className="mt-1.5 text-sm font-semibold uppercase tracking-widest text-[#d8cbbd]">
          {stopsToday === 1 ? "stop today" : "stops today"}
        </p>

        {done > 0 && (
          <p className="mt-2.5 border-t border-[#46586f] pt-2 text-sm font-semibold text-[#d8b98a]">
            {done} of {stopsToday} done
          </p>
        )}


        {today && today.notReady > 0 && (
          <p className="mt-2 border-t border-[#46586f] pt-2 text-sm text-amber-300">
            {today.notReady} of them {today.notReady === 1 ? "is" : "are"} still being washed — check
            before you load.
          </p>
        )}
      </section>

      {runs.length === 0 && (
        <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-8 text-center text-[#8a9099]">
          Nothing to deliver right now.
        </p>
      )}

      {pickups.length > 0 && (
        <section className="mb-6">
          {/*
            Collections lead the page. Nothing can be washed that has not been
            fetched, and a collection missed today is an order that never
            existed — which no later screen will ever show as late.
          */}
          <h2 className="mb-2.5 flex flex-wrap items-baseline gap-x-3 rounded-lg bg-sky-600 px-4 py-2.5 text-white">
            <span className="text-xl font-black uppercase tracking-wide">To collect</span>
            <span className="ml-auto text-sm font-bold">
              {pickups.filter((p) => p.status === "waiting" || p.status === "out").length} left
            </span>
          </h2>
          <div className="space-y-2.5">
            {pickups.map((p) => (
              <PickupCard key={p.id} pickup={p} onMark={markPickup} busy={pickupBusy} />
            ))}
          </div>
        </section>
      )}

      {today && (
        <RunBlock run={today} people={people} highlight stateOf={stateOf} record={record} />
      )}

      {rest.map((run) => (
        <RunBlock key={run.day} run={run} people={people} stateOf={stateOf} record={record} />
      ))}
    </main>
  );
}


/** One collection, with the same two taps the deliveries use. */
function PickupCard({
  pickup,
  onMark,
  busy,
}: {
  pickup: PickupRow;
  onMark: (id: string, status: string, reason?: string) => void;
  busy: string | null;
}) {
  const time = pickup.atTime
    ? (() => {
        const [h, m] = pickup.atTime.split(":").map(Number);
        const hour = h % 12 === 0 ? 12 : h % 12;
        return `${hour}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
      })()
    : null;
  const done = pickup.status === "done" || pickup.status === "missed";

  return (
    <article
      className={`flex overflow-hidden rounded-xl border bg-white ${
        done ? "border-sky-100 opacity-70" : "border-sky-300"
      }`}
    >
      <span className="w-1.5 shrink-0 bg-sky-500" />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="rounded bg-sky-600 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-white">
            Collect
          </span>
          <span className="text-2xl font-black leading-none text-[#26364d]">
            {time ?? <span className="text-base text-[#b8b1a8]">any time</span>}
          </span>
        </div>
        <p className="mt-1.5 truncate text-lg font-bold leading-tight text-[#26364d]">
          {pickup.name}
        </p>
        {pickup.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.address)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-[#3f4f61]"
          >
            {pickup.address}
          </a>
        )}
        {pickup.note && <p className="mt-1 text-xs text-[#546d83]">{pickup.note}</p>}
        {pickup.phone && (
          <a
            href={`tel:${pickup.phone.replace(/[^\d+]/g, "")}`}
            className="mt-2 block rounded-lg border border-sky-600 px-3 py-2.5 text-center text-sm font-bold text-sky-700 active:bg-sky-50"
          >
            Call {pickup.phone}
          </a>
        )}

        {pickup.status === "waiting" && (
          <button
            onClick={() => onMark(pickup.id, "out")}
            disabled={!!busy}
            className="mt-2 w-full rounded-lg bg-[#26364d] py-3 text-base font-black uppercase tracking-wider text-white active:bg-[#3f4f61] disabled:opacity-50"
          >
            {busy === pickup.id ? "…" : "Out to collect"}
          </button>
        )}

        {pickup.status === "out" && (
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={() => onMark(pickup.id, "done")}
              disabled={!!busy}
              className="rounded-lg bg-emerald-600 py-3 text-base font-black uppercase tracking-wider text-white active:bg-emerald-700 disabled:opacity-50"
            >
              {busy === pickup.id ? "…" : "Picked up"}
            </button>
            <button
              onClick={() => {
                const why = window.prompt("What happened? (nobody in, no answer…)");
                if (why !== null) onMark(pickup.id, "missed", why || "not collected");
              }}
              disabled={!!busy}
              className="rounded-lg border-2 border-red-300 px-3 text-sm font-bold uppercase text-red-700 active:bg-red-50 disabled:opacity-50"
            >
              Could not
            </button>
          </div>
        )}

        {pickup.status === "done" && (
          <p className="mt-2 rounded-lg bg-emerald-50 py-2.5 text-center text-sm font-black uppercase tracking-wider text-emerald-700">
            ✓ Picked up
          </p>
        )}
        {pickup.status === "missed" && (
          <p className="mt-2 rounded-lg bg-red-50 py-2.5 text-center text-sm font-black uppercase tracking-wider text-red-700">
            Not collected
          </p>
        )}
      </div>
    </article>
  );
}

function RunBlock({
  run,
  people,
  highlight = false,
  stateOf,
  record,
}: {
  run: Run;
  people: Record<string, Person>;
  highlight?: boolean;
  stateOf: (orderId: string) => StopState;
  record: (orderId: string | null, kind: EventKind, reason?: string) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const missed = run.label.startsWith("Missed");
  const done = run.stops.filter((s) => stateOf(s.id) === "delivered");
  const live = run.stops.filter((s) => stateOf(s.id) !== "delivered");

  /*
    Which day a stop belongs to decides whether the driver leaves now or
    tomorrow, so it cannot be a grey caption. Today is navy and loud, missed is
    red, everything else is quiet — and the calendar date is spelled out beside
    it, because "Tomorrow" on a page loaded last night is a trap.
  */
  const bar = missed
    ? "bg-red-600 text-white"
    : highlight
      ? "bg-[#26364d] text-white"
      : "bg-[#e6dccf] text-[#26364d]";

  return (
    <section className="mb-6">
      <h2
        className={`mb-2.5 flex flex-wrap items-baseline gap-x-3 rounded-lg px-4 py-2.5 ${bar}`}
      >
        <span className="text-xl font-black uppercase tracking-wide">{run.label}</span>
        <span className="text-sm font-semibold opacity-80">{dayName(run.day)}</span>
        <span className="ml-auto text-sm font-bold">
          {live.length} {live.length === 1 ? "stop" : "stops"}
          {done.length > 0 && <span className="opacity-70"> · {done.length} done</span>}
        </span>
      </h2>
      <div className="space-y-2.5">
        {live.map((stop) => (
          <Stop
            key={stop.id}
            stop={stop}
            person={people[stop.customerID]}
            state={stateOf(stop.id)}
            record={record}
          />
        ))}
        {live.length === 0 && done.length > 0 && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center text-sm font-semibold text-emerald-800">
            All {done.length} done.
          </p>
        )}
      </div>

      {done.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-xs font-bold uppercase tracking-wider text-[#8a9099] active:text-[#26364d]"
          >
            {showDone ? "Hide" : "Show"} {done.length} delivered
          </button>
          {showDone && (
            <div className="mt-2 space-y-2.5">
              {done.map((stop) => (
                <Stop
                  key={stop.id}
                  stop={stop}
                  person={people[stop.customerID]}
                  state={stateOf(stop.id)}
                  record={record}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stop({
  stop,
  person,
  state,
  record,
}: {
  stop: Assessed;
  person?: Person;
  state: StopState;
  record: (orderId: string | null, kind: EventKind, reason?: string) => void;
}) {
  const name = person?.name ?? `Customer ${stop.customerID}`;
  const tel = person?.tel;
  // The address written on the order wins: it is where this parcel was
  // promised, even if the customer has since moved.
  const place = stop.address ?? person?.place ?? null;
  const owes = !stop.paid && stop.total > 0;

  return (
    <article
      className={`rounded-xl border px-4 py-3 ${
        state === "delivered"
          ? "border-emerald-200 bg-emerald-50/40 opacity-70"
          : state === "onTheWay"
            ? "border-[#26364d] bg-white ring-1 ring-[#26364d]"
            : state === "failed"
              ? "border-red-300 bg-red-50"
              : stop.cleaned
                ? "border-[#ece7e1] bg-white"
                : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="rounded-lg bg-[#26364d] px-2.5 py-1 text-2xl font-black leading-none tracking-tight text-white">
              #{stop.id}
            </span>
            <span className="text-2xl font-black leading-none tracking-tight text-[#26364d]">
              {timeWindow(stop.dueTimeLabel) ?? (
                <span className="text-base text-[#b8b1a8]">no time set</span>
              )}
            </span>
          </p>
          <p className="mt-1.5 truncate text-lg font-bold leading-tight text-[#26364d]">{name}</p>
          {stop.pieces > 0 && <p className="text-xs text-[#8a9099]">{stop.pieces} pcs</p>}
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

      <div className="mt-2.5 flex flex-wrap items-stretch gap-2">
        {stop.cleaned ? (
          <span className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-black uppercase tracking-wider text-white">
            Ready
          </span>
        ) : (
          <span className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-black uppercase tracking-wider text-white">
            Not ready
          </span>
        )}
        {state === "onTheWay" && (
          <span className="rounded-lg bg-[#26364d] px-3 py-1.5 text-sm font-black uppercase tracking-wider text-white">
            In the van
          </span>
        )}
        {stop.rack ? (
          <span className="rounded-lg border-2 border-[#26364d] px-3 py-1.5 text-sm font-black uppercase tracking-wider text-[#26364d]">
            Rack {stop.rack}
          </span>
        ) : (
          <span className="rounded-lg border-2 border-dashed border-[#d8cbbd] px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-[#b8b1a8]">
            No rack
          </span>
        )}
      </div>

      {stop.summary && (
        <p className="mt-2 rounded-lg border border-[#ece7e1] bg-[#f8f1e7] px-3 py-2 text-sm leading-snug text-[#3f4f61]">
          <span className="mr-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-[#b8b1a8]">
            In the bag
          </span>
          {stop.summary}
        </p>
      )}

      {place ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded-lg bg-[#f0e9df] px-3 py-2 text-sm font-medium text-[#3f4f61] underline-offset-2 active:bg-[#e6dccf]"
        >
          {place}
        </a>
      ) : (
        <p className="mt-2 rounded-lg bg-[#f8f1e7] px-3 py-2 text-sm italic text-[#b8b1a8]">
          No address on file — ring to ask.
        </p>
      )}

      {stop.notes && <p className="mt-1.5 text-xs text-[#546d83]">Note: {stop.notes}</p>}

      {!stop.cleaned && (
        <p className="mt-1.5 text-xs font-semibold text-amber-800">
          Still being washed — do not load this one.
        </p>
      )}

      {tel && (
        <a
          href={`tel:${tel.replace(/[^\d+]/g, "")}`}
          className="mt-2 block rounded-lg border border-sky-600 px-3 py-2.5 text-center text-sm font-bold text-sky-700 active:bg-sky-50"
        >
          Call {tel}
        </a>
      )}

      {/*
        Big targets, pressed at the kerb with one hand. The card only ever
        offers the next thing that can happen to this parcel, so there is
        nothing to read and nothing to get wrong.
      */}
      {/*
        A parcel that is still in the machine cannot be in the van.

        The button used to be offered regardless, which let a driver mark a
        wash as on its way and left the shop believing a bag had gone out that
        was still wet. Readiness is CleanCloud's to say, so until it says so
        there is nothing to press.
      */}
      {state === "waiting" &&
        (stop.cleaned ? (
          <button
            onClick={() => record(stop.id, "on_the_way")}
            className="mt-2 w-full rounded-lg bg-[#26364d] py-3 text-base font-black uppercase tracking-wider text-white active:bg-[#3f4f61]"
          >
            Start delivery
          </button>
        ) : (
          <p className="mt-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 py-2.5 text-center text-sm font-bold uppercase tracking-wider text-amber-800">
            Still washing — not ready to load
          </p>
        ))}

      {state === "onTheWay" && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <button
            onClick={() => record(stop.id, "delivered")}
            className="rounded-lg bg-emerald-600 py-3 text-base font-black uppercase tracking-wider text-white active:bg-emerald-700"
          >
            Delivered
          </button>
          <button
            onClick={() => {
              const reason = window.prompt("What happened? (nobody in, refused, no answer…)");
              if (reason !== null) record(stop.id, "failed", reason || "not delivered");
            }}
            className="rounded-lg border-2 border-red-300 px-3 text-sm font-bold uppercase text-red-700 active:bg-red-50"
          >
            Could not
          </button>
        </div>
      )}

      {state === "delivered" && (
        <p className="mt-2 rounded-lg bg-emerald-50 py-2.5 text-center text-sm font-black uppercase tracking-wider text-emerald-700">
          ✓ Delivered
        </p>
      )}

      {state === "failed" &&
        (stop.cleaned ? (
          <button
            onClick={() => record(stop.id, "on_the_way")}
            className="mt-2 w-full rounded-lg border-2 border-amber-400 bg-amber-50 py-2.5 text-sm font-bold uppercase tracking-wider text-amber-800 active:bg-amber-100"
          >
            Not delivered — take it out again
          </button>
        ) : (
          <p className="mt-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 py-2.5 text-center text-sm font-bold uppercase tracking-wider text-amber-800">
            Not delivered · back in the wash
          </p>
        ))}

    </article>
  );
}
