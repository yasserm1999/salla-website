"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KIND_LABEL, KINDS, isMoney, type IssueKind } from "@/lib/issue-kinds";
import type { Issue } from "@/lib/issues";

/**
 * What is wrong, and what could be better.
 *
 * One list for both. A suggestion arrives the same way as a fault, from the
 * same people, and a separate box for ideas is a box nobody opens.
 *
 * The page reads differently depending on who opened it. A worker sees a form
 * and what he has reported — the shop's whole complaint book is not his to
 * read. An owner sees everything, and everything that can be done about it.
 */

type Person = { id: string; name: string; phone: string | null; cleanCloudId: string | null };

const KIND_SKIN: Record<IssueKind, string> = {
  inventory: "bg-sky-600",
  machinery: "bg-red-600",
  customer: "bg-amber-500",
  other: "bg-[#546d83]",
  suggestion: "bg-emerald-600",
  expense: "bg-[#b9925d]",
};

const money = (v: string) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function Issues({
  issues,
  people,
  staff,
  role,
  ready,
  problem,
}: {
  issues: Issue[];
  people: Person[];
  staff: string;
  role: "owner" | "driver" | "washer";
  ready: boolean;
  problem: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<"raise" | "open" | "done">(role === "owner" ? "open" : "raise");

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/issues", {
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

  const live = issues.filter((i) => i.status !== "done");
  const finished = issues.filter((i) => i.status === "done");
  const mine = live.filter((i) => i.assignedTo.includes(staff));

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Issues</h1>
          <p className="text-sm text-[#8a9099]">
            {role === "owner"
              ? "Everything reported, and what is being done about it"
              : "Report a fault, a complaint, or an idea"}
            {" · "}
            {staff}
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a]"
        >
          ← {role === "driver" ? "Deliveries" : role === "washer" ? "The work" : "Dashboard"}
        </Link>
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
        <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
          {note}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["raise", "Report something"],
            ["open", role === "owner" ? `Open (${live.length})` : `Mine (${live.length})`],
            ["done", `Completed (${finished.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              tab === key
                ? "bg-[#26364d] text-white"
                : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {role === "owner" && mine.length > 0 && tab === "open" && (
        <p className="mb-3 rounded-lg border border-[#d8b98a] bg-[#f8f1e7] px-4 py-2 text-sm font-semibold text-[#b9925d]">
          {mine.length} assigned to you.
        </p>
      )}

      {tab === "raise" && <RaiseForm people={people} busy={busy} send={send} />}

      {tab === "open" && (
        <IssueList
          issues={live}
          role={role}
          staff={staff}
          busy={busy}
          send={send}
          empty="Nothing outstanding."
        />
      )}

      {tab === "done" && (
        <IssueList
          issues={finished}
          role={role}
          staff={staff}
          busy={busy}
          send={send}
          empty="Nothing has been completed yet."
        />
      )}
    </main>
  );
}

type Send = (body: Record<string, unknown>, key: string) => Promise<boolean>;

function IssueList({
  issues,
  role,
  staff,
  busy,
  send,
  empty,
}: {
  issues: Issue[];
  role: "owner" | "driver" | "washer";
  staff: string;
  busy: string | null;
  send: Send;
  empty: string;
}) {
  if (issues.length === 0) {
    return (
      <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-8 text-center text-sm text-[#8a9099]">
        {empty}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {issues.map((i) => (
        <IssueCard key={i.id} issue={i} role={role} staff={staff} busy={busy} send={send} />
      ))}
    </div>
  );
}

function IssueCard({
  issue,
  role,
  staff,
  busy,
  send,
}: {
  issue: Issue;
  role: "owner" | "driver" | "washer";
  staff: string;
  busy: string | null;
  send: Send;
}) {
  const [comment, setComment] = useState("");
  const owner = role === "owner";

  return (
    <article className="overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#f0e9df] px-4 py-2.5">
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white ${KIND_SKIN[issue.kind]}`}
        >
          {KIND_LABEL[issue.kind]}
        </span>
        {issue.status === "doing" && (
          <span className="rounded bg-[#26364d] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
            In progress
          </span>
        )}
        {issue.status === "done" && (
          <span className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
            {isMoney(issue.kind) ? "✓ Paid" : "✓ Done"}
          </span>
        )}
        {isMoney(issue.kind) && issue.status !== "done" && (
          <span className="rounded border border-[#b9925d] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#b9925d]">
            Unpaid
          </span>
        )}
        {issue.amount && (
          <span className="text-base font-black tabular-nums text-[#26364d]">
            {money(issue.amount)}
          </span>
        )}
        <span className="ms-auto text-xs text-[#b8b1a8]">
          {issue.raisedBy} · {when(issue.raisedAt)}
        </span>
      </div>

      <div className="px-4 py-3">
        {issue.customerName && (
          <p className="mb-1.5 text-sm font-bold text-[#26364d]">
            About {issue.customerName}
            {issue.customerId && (
              <span className="ms-1.5 font-mono text-xs font-normal text-[#b8b1a8]">
                c{issue.customerId}
              </span>
            )}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm text-[#3f4f61]">{issue.description}</p>

        {issue.photoUrl && (
          <a href={issue.photoUrl} target="_blank" rel="noreferrer" className="mt-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={issue.photoUrl}
              alt="Photograph attached to the report"
              className="max-h-64 w-auto rounded-lg border border-[#ece7e1]"
            />
          </a>
        )}

        {issue.assignedTo.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-[#546d83]">
            With {issue.assignedTo.join(" and ")}
          </p>
        )}
        {issue.closedBy && issue.closedAt && (
          <p className="mt-1 text-xs text-emerald-700">
            Closed by {issue.closedBy} on {when(issue.closedAt)}
          </p>
        )}
      </div>

      {issue.notes.length > 0 && (
        <ul className="divide-y divide-[#f0e9df] border-t border-[#f0e9df] bg-[#faf7f2]">
          {issue.notes.map((n) => (
            <li key={n.id} className="px-4 py-2">
              <p className="text-sm text-[#3f4f61]">{n.body}</p>
              <p className="text-[11px] text-[#b8b1a8]">
                {n.by} · {when(n.at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {owner && (
        <div className="border-t border-[#f0e9df] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#b8b1a8]">
              Assign
            </span>
            {["yasser", "osama"].map((who) => {
              const on = issue.assignedTo.includes(who);
              return (
                <button
                  key={who}
                  onClick={() =>
                    send(
                      {
                        what: "assign",
                        id: issue.id,
                        to: on
                          ? issue.assignedTo.filter((x) => x !== who)
                          : [...issue.assignedTo, who],
                      },
                      issue.id
                    )
                  }
                  disabled={!!busy}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize transition disabled:opacity-50 ${
                    on
                      ? "bg-[#546d83] text-white"
                      : "border border-[#d8cbbd] text-[#546d83] hover:border-[#546d83]"
                  }`}
                >
                  {who}
                </button>
              );
            })}

            <span className="ms-auto flex gap-1.5">
              {issue.status !== "doing" && (
                <button
                  onClick={() => send({ what: "status", id: issue.id, status: "doing" }, issue.id)}
                  disabled={!!busy}
                  className="rounded-lg border border-[#26364d] px-2.5 py-1 text-xs font-bold text-[#26364d] hover:bg-[#f0e9df] disabled:opacity-50"
                >
                  In progress
                </button>
              )}
              {issue.status !== "done" ? (
                <button
                  onClick={() => send({ what: "status", id: issue.id, status: "done" }, issue.id)}
                  disabled={!!busy}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isMoney(issue.kind) ? "Mark paid" : "Mark done"}
                </button>
              ) : (
                <button
                  onClick={() => send({ what: "status", id: issue.id, status: "open" }, issue.id)}
                  disabled={!!busy}
                  className="rounded-lg border border-[#d8cbbd] px-2.5 py-1 text-xs font-bold text-[#b9925d] hover:border-[#b9925d] disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment"
              className="min-w-0 flex-1 rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
            />
            <button
              onClick={async () => {
                if (await send({ what: "note", id: issue.id, body: comment }, issue.id))
                  setComment("");
              }}
              disabled={!!busy || !comment.trim()}
              className="rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === issue.id ? "…" : "Say"}
            </button>
          </div>
        </div>
      )}

      {!owner && issue.status !== "done" && (
        <p className="border-t border-[#f0e9df] px-4 py-2 text-xs text-[#b8b1a8]">
          {isMoney(issue.kind)
            ? issue.status === "doing"
              ? "The shop has it."
              : "Not paid yet."
            : issue.assignedTo.length > 0
              ? "Somebody is on it."
              : "Waiting to be picked up."}
        </p>
      )}
    </article>
  );
}

/**
 * Reporting one.
 *
 * The photo is shrunk in the browser before it is sent. A picture straight off
 * a phone is several megabytes, and sending that from the kerb on a weak
 * signal is the difference between a report filed and a report abandoned.
 */
function RaiseForm({ people, busy, send }: { people: Person[]; busy: string | null; send: Send }) {
  const [kind, setKind] = useState<IssueKind>("machinery");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [shrinking, setShrinking] = useState(false);
  const [customer, setCustomer] = useState<Person | null>(null);
  const [q, setQ] = useState("");

  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const digits = needle.replace(/\D/g, "");
    return people
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits))
      )
      .slice(0, 6);
  }, [q, people]);

  async function takePhoto(file: File) {
    setShrinking(true);
    try {
      const bitmap = await createImageBitmap(file);
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = Math.min(1, 1400 / longest);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL("image/jpeg", 0.72));
    } catch {
      setPhoto(null);
    } finally {
      setShrinking(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#ece7e1] bg-white p-4">
      <p className="mb-1 text-sm font-bold uppercase tracking-widest text-[#26364d]">
        What is it?
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              kind === k
                ? `${KIND_SKIN[k]} text-white`
                : "border border-[#d8cbbd] text-[#546d83] hover:border-[#d8b98a]"
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {kind === "customer" && (
        <div className="mb-3">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
            Which customer
          </span>
          {customer ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#26364d] bg-white px-3 py-2">
              <span className="font-bold text-[#26364d]">{customer.name}</span>
              {customer.cleanCloudId && (
                <span className="font-mono text-xs text-[#b8b1a8]">c{customer.cleanCloudId}</span>
              )}
              <button
                onClick={() => setCustomer(null)}
                className="ms-auto text-xs font-semibold text-[#b9925d] hover:underline"
              >
                change
              </button>
            </div>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or phone"
                className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
              />
              {found.length > 0 && (
                <ul className="mt-1.5 divide-y divide-[#f0e9df] rounded-lg border border-[#ece7e1] bg-white">
                  {found.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setCustomer(p)}
                        className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-[#f8f1e7]"
                      >
                        <span className="font-semibold text-[#26364d]">{p.name}</span>
                        {p.cleanCloudId && (
                          <span className="font-mono text-[11px] text-[#b8b1a8]">
                            c{p.cleanCloudId}
                          </span>
                        )}
                        {p.phone && <span className="text-xs text-[#8a9099]">{p.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {isMoney(kind) && (
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
            How much
          </span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-lg font-bold tabular-nums outline-none focus:border-[#d8b98a]"
          />
        </label>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
          {isMoney(kind) ? "What it was for" : "What happened"}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={
            kind === "suggestion"
              ? "What would make this better?"
              : isMoney(kind)
                ? "What the money went on"
                : "Describe it in your own words"
          }
          className="w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
        />
      </label>

      <div className="mb-3">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]">
          {isMoney(kind) ? "The invoice — photograph it" : "Photo — if it helps"}
        </span>
        {photo ? (
          <div className="flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="What you just took" className="max-h-40 rounded-lg border border-[#ece7e1]" />
            <button
              onClick={() => setPhoto(null)}
              className="text-xs font-bold uppercase tracking-wider text-[#b9925d] hover:underline"
            >
              remove
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-[#d8cbbd] px-4 py-4 text-center text-sm font-semibold text-[#8a9099] hover:border-[#d8b98a]">
            {shrinking ? "Preparing the picture…" : "Take or choose a photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void takePhoto(file);
              }}
            />
          </label>
        )}
      </div>

      <button
        onClick={async () => {
          const ok = await send(
            {
              what: "raise",
              kind,
              description,
              amount,
              customerId: customer?.cleanCloudId ?? null,
              customerName: customer?.name ?? null,
              photo,
            },
            "raise"
          );
          if (ok) {
            setDescription("");
            setAmount("");
            setPhoto(null);
            setCustomer(null);
            setQ("");
          }
        }}
        disabled={
          !!busy ||
          !description.trim() ||
          (kind === "customer" && !customer) ||
          (isMoney(kind) && !/^\d{1,9}(\.\d{1,3})?$/.test(amount.trim()))
        }
        className="w-full rounded-lg bg-[#26364d] py-3 text-base font-bold text-white hover:bg-[#3f4f61] disabled:opacity-50"
      >
        {busy === "raise" ? "Sending…" : isMoney(kind) ? "Submit the expense" : "Send it"}
      </button>
    </section>
  );
}
