"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Job, JobKind, Person, Routine } from "@/lib/pickups";

/**
 * The day's round: collections and returns, in one list, down the clock.
 *
 * Deliberately not two lists. The driver leaves once and does whatever is
 * next, so splitting pickups from deliveries would mean reading both and
 * merging them by eye — which is the job the page is supposed to be doing. The
 * two are told apart by colour instead: sky for a collection, violet for a
 * return, the same violet the delivery runs already use on the shop board.
 *
 * Everything is one day wide. What is done stays visible until the day turns
 * over, because "is that one finished?" is a question asked all afternoon and
 * a list that hides its answers cannot be checked.
 */

const KIND: Record<
  JobKind,
  { label: string; bar: string; chip: string; ring: string; wash: string }
> = {
  pickup: {
    label: "Collect",
    bar: "bg-sky-500",
    chip: "bg-sky-600 text-white",
    ring: "border-sky-200",
    wash: "bg-sky-50/60",
  },
  delivery: {
    label: "Deliver",
    bar: "bg-violet-500",
    chip: "bg-violet-600 text-white",
    ring: "border-violet-200",
    wash: "bg-violet-50/60",
  },
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

export function Round({
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
  const [panel, setPanel] = useState<"none" | "add" | "repeat" | "repeats">("none");

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error ?? "That did not save.");
      else {
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

  const outstanding = jobs.filter((j) => j.status === "waiting" || j.status === "out");
  const settled = jobs.filter((j) => j.status === "done" || j.status === "missed");
  const counts = {
    pickups: jobs.filter((j) => j.kind === "pickup").length,
    deliveries: jobs.filter((j) => j.kind === "delivery").length,
    left: outstanding.length,
    done: jobs.filter((j) => j.status === "done").length,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">The round</h1>
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

      {/* ── The day, and how to move between days ──────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/pickups?day=${shift(day, -1)}`}
          className="rounded-lg border border-[#d8cbbd] px-2.5 py-1.5 text-sm font-bold text-[#546d83]"
        >
          ←
        </Link>
        {day !== today && (
          <Link
            href="/admin/pickups"
            className="rounded-lg bg-[#26364d] px-3 py-1.5 text-sm font-bold text-white"
          >
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
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> {counts.pickups} to collect
          </span>
          <span className="flex items-center gap-1.5 text-violet-700">
            <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> {counts.deliveries} to deliver
          </span>
        </span>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <Tile label="Still to do" value={counts.left} tone={counts.left > 0 ? "open" : "clear"} />
        <Tile label="Done today" value={counts.done} tone="clear" />
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPanel(panel === "add" ? "none" : "add")}
          className="rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white hover:bg-[#3f4f61]"
        >
          Add to the round
        </button>
        {role === "owner" && (
          <>
            <button
              onClick={() => setPanel(panel === "repeat" ? "none" : "repeat")}
              className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-bold text-[#546d83] hover:border-[#d8b98a]"
            >
              Set up a repeat
            </button>
            <button
              onClick={() => setPanel(panel === "repeats" ? "none" : "repeats")}
              className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-bold text-[#546d83] hover:border-[#d8b98a]"
            >
              Repeats ({routines.filter((r) => r.active).length})
            </button>
          </>
        )}
      </div>

      {panel === "add" && (
        <AddPanel people={people} day={day} busy={busy} send={send} onDone={() => setPanel("none")} />
      )}
      {panel === "repeat" && (
        <RepeatPanel people={people} day={day} busy={busy} send={send} onDone={() => setPanel("none")} />
      )}
      {panel === "repeats" && <RepeatList routines={routines} busy={busy} send={send} />}

      {/* ── Still to do ────────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Still to do — {outstanding.length}
        </h2>
        {outstanding.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm font-semibold text-emerald-800">
            {jobs.length === 0 ? "Nothing on for this day." : "All done."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {outstanding.map((j) => (
              <JobCard key={j.id} job={j} busy={busy} send={send} />
            ))}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#8a9099]">
            Finished — {settled.length}
          </h2>
          <div className="space-y-2">
            {settled.map((j) => (
              <JobCard key={j.id} job={j} busy={busy} send={send} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

type Send = (body: Record<string, unknown>, key: string) => Promise<boolean>;

function JobCard({ job, busy, send }: { job: Job; busy: string | null; send: Send }) {
  const k = KIND[job.kind];
  const settled = job.status === "done" || job.status === "missed";

  return (
    <article
      className={`flex gap-0 overflow-hidden rounded-xl border bg-white ${k.ring} ${
        settled ? "opacity-70" : ""
      }`}
    >
      {/* A colour down the edge: which errand this is, readable at a glance. */}
      <span className={`w-1.5 shrink-0 ${k.bar}`} />

      <div className="min-w-0 flex-1 px-3.5 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${k.chip}`}>
            {k.label}
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

        <p className="mt-1 truncate text-lg font-bold leading-tight text-[#26364d]">
          {job.person.name}
        </p>
        {job.person.address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.person.address)}`}
            target="_blank"
            rel="noreferrer"
            className={`mt-1 block rounded-lg px-2.5 py-1.5 text-sm text-[#3f4f61] ${k.wash}`}
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
            ✓ {job.kind === "pickup" ? "Collected" : "Delivered"} {stamp(job.doneAt)}
            {job.byStaff ? ` · ${job.byStaff}` : ""}
          </p>
        )}
        {job.status === "missed" && (
          <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
            Not done — {job.reason ?? "no reason given"}
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

        {/* One button at a time: only ever the next thing that can happen. */}
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
              {busy === job.id ? "…" : job.kind === "pickup" ? "Picked up" : "Delivered"}
            </button>
            <button
              onClick={() => {
                const reason = window.prompt("What happened? (nobody in, no answer…)");
                if (reason !== null)
                  void send(
                    { what: "status", id: job.id, status: "missed", reason: reason || "not done" },
                    job.id
                  );
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
        <button
          onClick={() => onPick("")}
          className="ms-auto text-xs font-semibold text-[#b9925d] hover:underline"
        >
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
                {p.address && (
                  <span className="ms-auto truncate text-xs text-[#b8b1a8]">{p.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && found.length === 0 && (
        <p className="mt-1.5 text-xs text-[#8a9099]">
          Nobody by that name or number. Use &ldquo;someone new&rdquo; below.
        </p>
      )}
    </div>
  );
}

function NewPerson({
  busy,
  send,
  onAdded,
}: {
  busy: string | null;
  send: Send;
  onAdded: () => void;
}) {
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
        <span className="ms-2 text-xs text-[#8a9099]">
          Then search for them above and add the job.
        </span>
      </div>
    </div>
  );
}

function KindPicker({ value, onChange }: { value: JobKind; onChange: (k: JobKind) => void }) {
  return (
    <div className="flex gap-2">
      {(["pickup", "delivery"] as JobKind[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-black uppercase tracking-wider transition ${
            value === k
              ? KIND[k].chip
              : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
          }`}
        >
          {KIND[k].label}
        </button>
      ))}
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
  const [kind, setKind] = useState<JobKind>("pickup");
  const [onDate, setOnDate] = useState(day);
  const [atTime, setAtTime] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  return (
    <section className="mb-4 rounded-xl border border-[#ece7e1] bg-white p-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#26364d]">
        Add to the round
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

        <KindPicker value={kind} onChange={setKind} />

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Day
            </span>
            <input
              type="date"
              value={onDate}
              onChange={(e) => setOnDate(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Time — leave blank for any
            </span>
            <input
              type="time"
              value={atTime}
              onChange={(e) => setAtTime(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Note
            </span>
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
            if (await send({ what: "job", personId, kind, onDate, atTime, note }, "job")) onDone();
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
  const [kind, setKind] = useState<JobKind>("pickup");
  const [everyDays, setEveryDays] = useState("7");
  const [startsOn, setStartsOn] = useState(day);
  const [atTime, setAtTime] = useState("");
  const [note, setNote] = useState("");

  return (
    <section className="mb-4 rounded-xl border border-[#ece7e1] bg-white p-4">
      <p className="text-sm font-bold uppercase tracking-widest text-[#26364d]">Set up a repeat</p>
      <p className="mb-3 text-xs text-[#8a9099]">
        It appears on the round by itself, every so many days from the start day.
      </p>
      <div className="space-y-3">
        <PersonPicker people={people} value={personId} onPick={setPersonId} />
        <KindPicker value={kind} onChange={setKind} />

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
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Starting
            </span>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Time
            </span>
            <input
              type="time"
              value={atTime}
              onChange={(e) => setAtTime(e.target.value)}
              className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
              Note
            </span>
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
                { what: "routine", personId, kind, everyDays: Number(everyDays), startsOn, atTime, note },
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
}: {
  routines: Routine[];
  busy: string | null;
  send: Send;
}) {
  const live = routines.filter((r) => r.active);
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
      <p className="border-b border-[#f0e9df] px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-[#26364d]">
        Standing arrangements
      </p>
      {live.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[#8a9099]">None set up yet.</p>
      ) : (
        <ul className="divide-y divide-[#f0e9df]">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm">
              <span className={`rounded px-1.5 text-[11px] font-black uppercase ${KIND[r.kind].chip}`}>
                {KIND[r.kind].label}
              </span>
              <span className="font-semibold text-[#26364d]">{r.person.name}</span>
              <span className="text-[#546d83]">
                every {r.everyDays} day{r.everyDays === 1 ? "" : "s"}
                {r.atTime ? ` at ${clock(r.atTime)}` : ""}
              </span>
              <span className="text-xs text-[#b8b1a8]">next {r.nextDue}</span>
              <button
                onClick={() => send({ what: "stopRoutine", id: r.id }, r.id)}
                disabled={!!busy}
                className="ms-auto text-xs font-bold uppercase tracking-wider text-[#b9925d] hover:underline disabled:opacity-50"
              >
                {busy === r.id ? "…" : "stop"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: "open" | "clear" }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        tone === "open"
          ? "border-[#26364d] bg-[#26364d] text-white"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <p className="text-[0.68rem] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 text-4xl font-black leading-none">{value}</p>
    </div>
  );
}
