"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job, Person, Routine } from "@/lib/pickups";

/**
 * The collections the shop schedules for itself.
 *
 * Pickups and nothing else. Deliveries live in CleanCloud and are marked off
 * on the driver's own page; drawing them here as well only raised the question
 * of which screen was the real one.
 *
 * This page only ever arranges them. Marking one out and collected happens
 * where the driver actually is — on his round, and on the shop board beside
 * the deliveries — because a job that can be ticked off in two places will
 * eventually be ticked off in one and missed in the other.
 */

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

/**
 * How a repeat is actually said out loud.
 *
 * Any interval that divides into weeks lands on the same weekday every
 * time, and "every Saturday" is what somebody arranging a collection
 * agreed to — the number of days is the arithmetic behind it, not the
 * arrangement. Anything else has no weekday to name, so it stays a count.
 */
const ORDINALS = ["", "", "2nd ", "3rd ", "4th "];

function repeatLabel(everyDays: number, anyDayItFalls: string): string {
  const weeks = everyDays / 7;
  if (!Number.isInteger(weeks) || weeks > 4) {
    return everyDays === 1 ? "every day" : `every ${everyDays} days`;
  }
  const weekday = new Date(Date.parse(`${anyDayItFalls}T12:00:00Z`)).toLocaleDateString(
    "en-GB",
    { weekday: "long" }
  );
  return `every ${ORDINALS[weeks]}${weekday}`;
}

const minutesOf = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function Pickups({
  day,
  today,
  jobs,
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
  const [panel, setPanel] = useState<"add" | "repeat" | "repeats" | "booked">("add");
  const live = routines.filter((r) => r.active);

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

  /*
    Down the clock, with anything untimed last: a pickup with no promised hour
    can be fitted around the ones that have.
  */
  const inOrder = [...jobs].sort((a, b) => {
    const at = minutesOf(a.atTime);
    const bt = minutesOf(b.atTime);
    if (at !== null && bt !== null && at !== bt) return at - bt;
    if (at !== null && bt === null) return -1;
    if (at === null && bt !== null) return 1;
    return a.person.name.localeCompare(b.person.name);
  });

  const open = inOrder.filter((j) => j.status === "waiting" || j.status === "out");
  const settled = inOrder.filter((j) => j.status !== "waiting" && j.status !== "out");

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
        <span className="ms-auto flex items-center gap-1.5 text-xs font-semibold text-sky-700">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
          {jobs.length} pickup{jobs.length === 1 ? "" : "s"} this day
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {/*
          One tab is always open, and it shows one thing. Panels used to leave
          the day's list sitting underneath them, which read as part of
          whatever was being arranged rather than as a separate answer.
        */}
        {(
          [
            ["add", "Schedule a pickup"],
            ["repeat", "Set up a repeat"],
            ["repeats", `Repeating pickups (${live.length})`],
            ["booked", `Booked in (${open.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setPanel(key);
              setError(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              panel === key
                ? "bg-[#26364d] text-white"
                : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => send({ what: "syncCustomers" }, "sync")}
          disabled={!!busy}
          className="ms-auto rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#8a9099] hover:border-[#d8b98a] disabled:opacity-50"
          title="Copy the shop&rsquo;s customers across from CleanCloud so they can be searched"
        >
          {busy === "sync" ? "Fetching customers…" : `Customers (${people.length})`}
        </button>
      </div>

      {panel === "add" && (
        <AddPanel people={people} day={day} busy={busy} send={send} onDone={() => setPanel("booked")} />
      )}
      {panel === "repeat" && (
        <RepeatPanel people={people} day={day} busy={busy} send={send} onDone={() => setPanel("booked")} />
      )}
      {panel === "repeats" && (
        <section className="mb-4">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
            Repeating pickups — {live.length}
          </p>
          <RepeatList routines={routines} busy={busy} send={send} canStop={role === "owner"} />
        </section>
      )}

      {/*
        What is on for the day, and what became of it.

        A tab of its own because it is a different question from the three
        arranging ones, and because this is where a booked pickup is called
        off — the one thing on this page that changes an errand already made.
      */}
      {panel === "booked" && (
        <>
          {/* ── The day, down the clock ─────────────────────────────────── */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
              Booked in for this day — {open.length}
            </h2>
            {open.length === 0 ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm font-semibold text-emerald-800">
                {jobs.length === 0 ? "No pickups on for this day." : "All collected."}
              </p>
            ) : (
              <div className="space-y-2.5">
                {open.map((job) => (
                  <PickupCard
                    key={job.id}
                    job={job}
                    busy={busy}
                    send={send}
                    onNeedReason={() => setError("A cancellation needs a reason.")}
                  />
                ))}
              </div>
            )}
          </section>

          {settled.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#8a9099]">
                Finished — {settled.length}
              </h2>
              <div className="space-y-2">
                {settled.map((j) => (
                  <PickupCard
                    key={j.id}
                    job={j}
                    busy={busy}
                    send={send}
                    onNeedReason={() => setError("A cancellation needs a reason.")}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

    </main>
  );
}

type Send = (body: Record<string, unknown>, key: string) => Promise<boolean>;

function PickupCard({
  job,
  busy,
  send,
  onNeedReason,
}: {
  job: Job;
  busy: string | null;
  send: Send;
  onNeedReason: () => void;
}) {
  const settled = job.status !== "waiting" && job.status !== "out";

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
              {repeatLabel(job.everyDays, job.onDate)}
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
        {job.status === "cancelled" && (
          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-[#b9925d]">
            Cancelled — {job.reason ?? "no reason given"}
            {job.byStaff ? ` · ${job.byStaff}` : ""}
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

        {/*
          Calling it off stays available until it is finished, and always
          costs a reason: a pickup that simply disappears from the day leaves
          nothing to ask anybody about afterwards.
        */}
        {(job.status === "waiting" || job.status === "out") && (
          <button
            onClick={() => {
              const reason = window.prompt(
                `Why is ${job.person.name}'s pickup being cancelled?`
              );
              if (reason === null) return;
              if (!reason.trim()) {
                onNeedReason();
                return;
              }
              void send(
                { what: "status", id: job.id, status: "cancelled", reason: reason.trim() },
                job.id
              );
            }}
            disabled={!!busy}
            className="mt-2 w-full rounded-lg border border-[#d8cbbd] py-2 text-xs font-bold uppercase tracking-wider text-[#b9925d] hover:border-[#b9925d] disabled:opacity-50"
          >
            Cancel this pickup
          </button>
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
                {repeatLabel(r.everyDays, r.nextDue)}
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
