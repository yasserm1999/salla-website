"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job, Person, Routine } from "@/lib/pickups";

/**
 * The day's collections, with the deliveries already owed shown beside them.
 *
 * The shop schedules its own pickups; CleanCloud owns the deliveries. So only
 * one half of this page can be acted on — a pickup can be marked out and
 * collected here, a delivery is shown so the driver can plan around it and is
 * marked off where it lives, on his own deliveries page.
 *
 * One list down the clock rather than two, because the driver leaves once and
 * does whatever is next. Sky is a collection, violet a delivery — the same
 * violet the delivery runs already use on the shop board.
 */

export type DeliveryStop = {
  id: string;
  customerID: string;
  window: string | null;
  minutes: number | null;
  cleaned: boolean;
  rack: string | null;
  pieces: number;
  total: number;
  paid: boolean;
};

const clock = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};

const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

const dayName = (d: string) =>
  new Date(Date.parse(`${d}T12:00:00Z`)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const shift = (d: string, by: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

const minutesOf = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

type Row =
  | { sort: number | null; kind: "pickup"; job: Job }
  | { sort: number | null; kind: "delivery"; stop: DeliveryStop };

export function Pickups({
  day,
  today,
  jobs,
  deliveries,
  people,
  routines,
  staff,
  role,
  ready,
  problem,
}: {
  day: string;
  today: string;
  jobs: Job[];
  deliveries: DeliveryStop[];
  people: Person[];
  routines: Routine[];
  staff: string;
  role: "owner" | "driver";
  ready: boolean;
  problem: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "add" | "repeat">("none");
  const [names, setNames] = useState<Record<string, string>>({});

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error ?? "That did not save.");
      else {
        if (data?.message) setNote(data.message);
        router.refresh();
        return true;
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
    return false;
  }

  // Delivery names come from the same lookup the rest of the admin uses.
  useMemo(() => {
    const ids = deliveries.map((d) => d.customerID).filter((id) => id && !(id in names));
    if (ids.length === 0) return;
    void fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...new Set(ids)].slice(0, 40) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.people) return;
        const next: Record<string, string> = {};
        for (const [id, p] of Object.entries(d.people as Record<string, { name: string | null }>)) {
          if (p.name) next[id] = p.name;
        }
        setNames((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveries]);

  const rows: Row[] = [
    ...jobs.map((job) => ({ sort: minutesOf(job.atTime), kind: "pickup" as const, job })),
    ...deliveries.map((stop) => ({ sort: stop.minutes, kind: "delivery" as const, stop })),
  ].sort((a, b) => {
    if (a.sort !== null && b.sort !== null && a.sort !== b.sort) return a.sort - b.sort;
    if (a.sort !== null && b.sort === null) return -1;
    if (a.sort === null && b.sort !== null) return 1;
    return 0;
  });

  const open = rows.filter((r) => r.kind === "delivery" || r.job.status === "waiting" || r.job.status === "out");
  const settled = jobs.filter((j) => j.status === "done" || j.status === "missed");

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Pickups</h1>
          <p className="text-sm text-[#8a9099]">
            {dayName(day)}
            {day === today ? " · today" : ""} · {staff}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a]"
          >
            ← {role === "owner" ? "Dashboard" : "Deliveries"}
          </Link>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a]"
          >
            Refresh
          </button>
        </div>
      </header>

      {!ready && (
        <p className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-bold">Nothing here can be saved.</span> {problem}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {note && (
        <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {note}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/pickups?day=${shift(day, -1)}`}
          className="rounded-lg border border-[#d8cbbd] px-2.5 py-1.5 text-sm font-bold text-[#546d83]"
        >
          ←
        </Link>
        {day !== today && (
          <Link href="/admin/pickups" className="rounded-lg bg-[#26364d] px-3 py-1.5 text-sm font-bold text-white">
            Today
          </Link>
        )}
        <Link
          href={`/admin/pickups?day=${shift(day, 1)}`}
          className="rounded-lg border border-[#d8cbbd] px-2.5 py-1.5 text-sm font-bold text-[#546d83]"
        >
          →
        </Link>
        <span className="ms-auto flex flex-wrap items-center gap-x-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-sky-700">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> {jobs.length} to collect
          </span>
          <span className="flex items-center gap-1.5 text-violet-700">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> {deliveries.length} to deliver
          </span>
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPanel(panel === "add" ? "none" : "add")}
          className="rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white hover:bg-[#3f4f61]"
        >
          Schedule a pickup
        </button>
        {role === "owner" && (
          <button
            onClick={() => setPanel(panel === "repeat" ? "none" : "repeat")}
            className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-bold text-[#546d83] hover:border-[#d8b98a]"
          >
            Set up a repeat
          </button>
        )}
        <button
          onClick={() => send({ what: "syncCustomers" }, "sync")}
          disabled={!!busy}
          className="ms-auto rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#8a9099] hover:border-[#d8b98a] disabled:opacity-50"
          title="Copy the shop's customers across from CleanCloud so they can be searched"
        >
          {busy === "sync" ? "Fetching customers…" : `Customers (${people.length})`}
        </button>
      </div>

      {panel === "add" && (
        <AddPanel people={people} day={day} busy={busy} send={send} onDone={() => setPanel("none")} />
      )}
      {panel === "repeat" && (
        <RepeatPanel people={people} day={day} busy={busy} send={send} onDone={() => setPanel("none")} />
      )}

      {/* ── The day, both kinds, down the clock ─────────────────────── */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          The day — {open.length}
        </h2>
        {open.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm font-semibold text-emerald-800">
            {rows.length === 0 ? "Nothing on for this day." : "All done."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {open.map((r) =>
              r.kind === "pickup" ? (
                <PickupCard key={`p${r.job.id}`} job={r.job} busy={busy} send={send} />
              ) : (
                <DeliveryCard key={`d${r.stop.id}`} stop={r.stop} name={names[r.stop.customerID]} />
              )
            )}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#8a9099]">
            Collected — {settled.length}
          </h2>
          <div className="space-y-2">
            {settled.map((j) => (
              <PickupCard key={j.id} job={j} busy={busy} send={send} />
            ))}
          </div>
        </section>
      )}

      {/* ── The standing arrangements ───────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Repeating pickups — {routines.filter((r) => r.active).length}
        </h2>
        <RepeatList routines={routines} busy={busy} send={send} canStop={role === "owner"} />
      </section>
    </main>
  );
}

type Send = (body: Record<string, unknown>, key: string) => Promise<boolean>;

function PickupCard({ job, busy, send }: { job: Job; busy: string | null; send: Send }) {
  const settled = job.status === "done" || job.status === "missed";

  return (
    <article
      className={`flex overflow-hidden rounded-xl border border-sky-200 bg-white ${
        settled ? "opacity-70" : ""
      }`}
    >
      <span className="w-1.5 shrink-0 bg-sky-500" />
      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
            Collect
          </span>
          <span className="text-xl font-black leading-none text-[#26364d]">
            {clock(job.atTime) ?? <span className="text-base text-[#b8b1a8]">any time</span>}
          </span>
          {job.everyDays && (
            <span className="rounded bg-[#f0e9df] px-1.5 text-[11px] font-semibold text-[#546d83]">
              every {job.everyDays}d
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-lg font-bold leading-tight text-[#26364d]">{job.person.name}</p>
        {job.person.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.person.address)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block rounded-lg bg-sky-50/60 px-2.5 py-1.5 text-sm text-[#3f4f61]"
          >
            {job.person.address}
          </a>
        )}
        {job.note && <p className="mt-1 text-xs text-[#546d83]">{job.note}</p>}

        {job.status === "out" && (
          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-[#26364d]">
            On the way since {stamp(job.outAt)}
          </p>
        )}
        {job.status === "done" && (
          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
            ✓ Collected {stamp(job.doneAt)}
            {job.byStaff ? ` · ${job.byStaff}` : ""}
          </p>
        )}
        {job.status === "missed" && (
          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
            Not collected — {job.reason ?? "no reason given"}
          </p>
        )}

        {job.person.phone && (
          <a
            href={`tel:${job.person.phone.replace(/[^\d+]/g, "")}`}
            className="mt-2 block rounded-lg border border-sky-600 px-3 py-2 text-center text-sm font-bold text-sky-700 active:bg-sky-50"
          >
            Call {job.person.phone}
          </a>
        )}

        {job.status === "waiting" && (
          <button
            onClick={() => send({ what: "status", id: job.id, status: "out" }, job.id)}
            disabled={!!busy}
            className="mt-2 w-full rounded-lg bg-[#26364d] py-3 text-base font-black uppercase tracking-wider text-white active:bg-[#3f4f61] disabled:opacity-50"
          >
            {busy === job.id ? "…" : "Out to collect"}
          </button>
        )}

        {job.status === "out" && (
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={() => send({ what: "status", id: job.id, status: "done" }, job.id)}
              disabled={!!busy}
              className="rounded-lg bg-emerald-600 py-3 text-base font-black uppercase tracking-wider text-white active:bg-emerald-700 disabled:opacity-50"
            >
              {busy === job.id ? "…" : "Picked up"}
            </button>
            <button
              onClick={() => {
                const reason = window.prompt("What happened? (nobody in, no answer…)");
                if (reason !== null)
                  void send({ what: "status", id: job.id, status: "missed", reason: reason || "not collected" }, job.id);
              }}
              disabled={!!busy}
              className="rounded-lg border-2 border-red-300 px-3 text-sm font-bold uppercase text-red-700 active:bg-red-50 disabled:opacity-50"
            >
              Could not
            </button>
          </div>
        )}

        {settled && (
          <button
            onClick={() => send({ what: "status", id: job.id, status: "waiting" }, job.id)}
            disabled={!!busy}
            className="mt-2 text-xs font-bold uppercase tracking-wider text-[#b9925d] hover:underline disabled:opacity-50"
          >
            Put it back on the list
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * A delivery, shown but not touchable.
 *
 * It belongs to CleanCloud and is marked off on the driver's own deliveries
 * page. Repeating the buttons here would mean two places to mark the same
 * thing, and sooner or later they would disagree.
 */
function DeliveryCard({ stop, name }: { stop: DeliveryStop; name?: string }) {
  return (
    <article className="flex overflow-hidden rounded-xl border border-violet-200 bg-white">
      <span className="w-1.5 shrink-0 bg-violet-500" />
      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
            Deliver
          </span>
          <span className="text-xl font-black leading-none text-[#26364d]">
            {stop.window?.replace(/\s*-\s*/, "–") ?? (
              <span className="text-base text-[#b8b1a8]">no time</span>
            )}
          </span>
          <span className="rounded bg-[#26364d] px-1.5 text-sm font-bold text-white">#{stop.id}</span>
        </div>

        <p className="mt-1 truncate text-lg font-bold leading-tight text-[#26364d]">
          {name ?? `Customer ${stop.customerID}`}
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-1.5">
          {stop.cleaned ? (
            <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Ready
            </span>
          ) : (
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Washing
            </span>
          )}
          {stop.rack && (
            <span className="rounded border border-[#26364d] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#26364d]">
              Rack {stop.rack}
            </span>
          )}
          {!stop.paid && stop.total > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
              collect {stop.total.toFixed(2)}
            </span>
          )}
        </p>

        <p className="mt-1.5 text-xs text-[#b8b1a8]">
          From CleanCloud — mark it off on the deliveries page.
        </p>
      </div>
    </article>
  );
}

/** Finding somebody by the two things anybody actually knows about them. */
function PersonPicker({
  people,
  value,
  onPick,
}: {
  people: Person[];
  value: string;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return people.slice(0, 8);
    const digits = needle.replace(/\D/g, "");
    return people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits))
      )
      .slice(0, 8);
  }, [q, people]);

  const chosen = people.find((p) => p.id === value);

  if (chosen) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#26364d] bg-white px-3 py-2">
        <span className="font-bold text-[#26364d]">{chosen.name}</span>
        {chosen.phone && <span className="text-xs text-[#8a9099]">{chosen.phone}</span>}
        <button onClick={() => onPick("")} className="ms-auto text-xs font-semibold text-[#b9925d] hover:underline">
          change
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or phone"
        className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
      />
      {found.length > 0 && (
        <ul className="mt-1.5 max-h-44 divide-y divide-[#f0e9df] overflow-y-auto rounded-lg border border-[#ece7e1] bg-white">
          {found.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPick(p.id)}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-[#f8f1e7]"
              >
                <span className="font-semibold text-[#26364d]">{p.name}</span>
                {p.phone && <span className="text-xs text-[#8a9099]">{p.phone}</span>}
                {p.address && <span className="ms-auto truncate text-xs text-[#b8b1a8]">{p.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && found.length === 0 && (
        <p className="mt-1.5 text-xs text-[#8a9099]">
          Nobody by that name or number. Press <strong>Customers</strong> above to bring the shop&rsquo;s
          list across from CleanCloud, or add them as new below.
        </p>
      )}
    </div>
  );
}

function NewPerson({ busy, send, onAdded }: { busy: string | null; send: Send; onAdded: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-[#d8cbbd] bg-[#faf7f2] p-3 sm:grid-cols-3">
      <input
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
        placeholder="Name"
        className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
      />
      <input
        value={f.phone}
        onChange={(e) => setF({ ...f, phone: e.target.value })}
        placeholder="Phone"
        className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
      />
      <input
        value={f.address}
        onChange={(e) => setF({ ...f, address: e.target.value })}
        placeholder="Address"
        className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
      />
      <div className="sm:col-span-3">
        <button
          onClick={async () => {
            if (await send({ what: "person", ...f }, "person")) {
              setF({ name: "", phone: "", address: "" });
              onAdded();
            }
          }}
          disabled={!!busy || !f.name.trim()}
          className="rounded-lg bg-[#546d83] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "person" ? "Saving…" : "Save the customer"}
        </button>
        <span className="ms-2 text-xs text-[#8a9099]">Then search for them above.</span>
      </div>
    </div>
  );
}

function AddPanel({
  people,
  day,
  busy,
  send,
  onDone,
}: {
  people: Person[];
  day: string;
  busy: string | null;
  send: Send;
  onDone: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [onDate, setOnDate] = useState(day);
  const [atTime, setAtTime] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  return (
    <section className="mb-4 rounded-xl border border-[#ece7e1] bg-white p-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#26364d]">
        Schedule a pickup
      </p>
      <div className="space-y-3">
        <PersonPicker people={people} value={personId} onPick={setPersonId} />
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-bold uppercase tracking-wider text-[#b9925d] hover:underline"
        >
          {adding ? "Never mind" : "Or someone new"}
        </button>
        {adding && <NewPerson busy={busy} send={send} onAdded={() => setAdding(false)} />}

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">Day</span>
            <input
              type="date"
              value={onDate}
              onChange={(e) => setOnDate(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Time — blank for any
            </span>
            <input
              type="time"
              value={atTime}
              onChange={(e) => setAtTime(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="optional"
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
        </div>

        <button
          onClick={async () => {
            if (await send({ what: "job", personId, onDate, atTime, note }, "job")) onDone();
          }}
          disabled={!!busy || !personId}
          className="w-full rounded-lg bg-[#26364d] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "job" ? "Saving…" : "Add it"}
        </button>
      </div>
    </section>
  );
}

function RepeatPanel({
  people,
  day,
  busy,
  send,
  onDone,
}: {
  people: Person[];
  day: string;
  busy: string | null;
  send: Send;
  onDone: () => void;
}) {
  const [personId, setPersonId] = useState("");
  const [everyDays, setEveryDays] = useState("7");
  const [startsOn, setStartsOn] = useState(day);
  const [atTime, setAtTime] = useState("");
  const [note, setNote] = useState("");

  return (
    <section className="mb-4 rounded-xl border border-[#ece7e1] bg-white p-4">
      <p className="text-sm font-bold uppercase tracking-widest text-[#26364d]">Set up a repeat</p>
      <p className="mb-3 text-xs text-[#8a9099]">
        The pickup appears by itself, every so many days from the start day.
      </p>
      <div className="space-y-3">
        <PersonPicker people={people} value={personId} onPick={setPersonId} />

        <div className="grid gap-2 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Every … days
            </span>
            <input
              type="number"
              min={1}
              max={180}
              value={everyDays}
              onChange={(e) => setEveryDays(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">Starting</span>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">Time</span>
            <input
              type="time"
              value={atTime}
              onChange={(e) => setAtTime(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="optional"
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
        </div>

        <button
          onClick={async () => {
            if (
              await send(
                { what: "routine", personId, everyDays: Number(everyDays), startsOn, atTime, note },
                "routine"
              )
            )
              onDone();
          }}
          disabled={!!busy || !personId}
          className="w-full rounded-lg bg-[#26364d] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "routine" ? "Saving…" : "Save the repeat"}
        </button>
      </div>
    </section>
  );
}

function RepeatList({
  routines,
  busy,
  send,
  canStop,
}: {
  routines: Routine[];
  busy: string | null;
  send: Send;
  canStop: boolean;
}) {
  const live = routines.filter((r) => r.active);
  return (
    <div className="overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
      {live.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[#8a9099]">
          None yet. A repeat puts the pickup on the day by itself, so nobody has to remember it.
        </p>
      ) : (
        <ul className="divide-y divide-[#f0e9df]">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm">
              <span className="w-1 self-stretch bg-sky-500" />
              <span className="font-semibold text-[#26364d]">{r.person.name}</span>
              {r.person.phone && <span className="text-xs text-[#8a9099]">{r.person.phone}</span>}
              <span className="text-[#546d83]">
                every {r.everyDays} day{r.everyDays === 1 ? "" : "s"}
                {r.atTime ? ` at ${clock(r.atTime)}` : ""}
              </span>
              <span className="text-xs font-semibold text-[#b8b1a8]">next {r.nextDue}</span>
              {canStop && (
                <button
                  onClick={() => send({ what: "stopRoutine", id: r.id }, r.id)}
                  disabled={!!busy}
                  className="ms-auto text-xs font-bold uppercase tracking-wider text-[#b9925d] hover:underline disabled:opacity-50"
                >
                  {busy === r.id ? "…" : "stop"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
