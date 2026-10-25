"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpenRequest } from "@/lib/quality";

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Muscat",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Changes staff have asked for, each answered with one tap. */
export function Requests({ requests }: { requests: OpenRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const open = requests.filter((r) => !done.has(r.id));
  if (open.length === 0) return null;

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "decide", requestId: id, approve }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDone((d) => new Set(d).add(id));
        router.refresh();
      } else setError(data?.error ?? "Not saved.");
    } catch {
      setError("No connection — nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-xl border-2 border-amber-300 bg-amber-50">
      <h2 className="flex items-center gap-2 px-4 py-3 font-bold text-[#26364d]">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-sm font-black text-white">
          {open.length}
        </span>
        Waiting for your approval
      </h2>
      {error && <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
      <ul className="divide-y divide-amber-200 border-t border-amber-200 bg-white/70">
        {open.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="rounded bg-[#26364d] px-1.5 font-mono text-sm font-bold text-white">#{r.orderId}</span>
              <span className="min-w-0 truncate text-sm font-semibold text-[#26364d]">{r.customerName ?? ""}</span>
            </p>
            <p className="mt-1 text-sm text-[#26364d]">
              <b>{r.requestedBy}</b> asks to{" "}
              {r.action === "remove" ? (
                <>
                  remove <b>{r.currentStaff}</b>&rsquo;s check
                </>
              ) : (
                <>
                  change <b>{r.currentStaff}</b> → <b>{r.toStaff}</b>
                </>
              )}
            </p>
            {r.reason && <p className="mt-0.5 text-sm italic text-[#546d83]">“{r.reason}”</p>}
            <p className="mt-0.5 text-xs text-[#8a9099]">
              checked {stamp(r.checkedAt)} · asked {stamp(r.requestedAt)}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => decide(r.id, true)}
                disabled={busy === r.id}
                className="h-11 flex-1 rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-40"
              >
                Approve
              </button>
              <button
                onClick={() => decide(r.id, false)}
                disabled={busy === r.id}
                className="h-11 flex-1 rounded-xl border-2 border-red-300 bg-white text-base font-bold text-red-700 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
