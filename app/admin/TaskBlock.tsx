"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Jobs given to this person, with the same two taps as a collection.
 *
 * A fault reported inside the shop — a missing brush, a machine to look at —
 * is somebody's errand like any other, and it belongs on the screen they are
 * already looking at rather than on a list they would have to remember to
 * open. Shown to the driver beside his round and to the washer beside his
 * work, because both are told to do things by somebody else.
 */

export type TaskRow = {
  id: string;
  kind: string;
  description: string;
  dueTime: string | null;
  status: "open" | "doing" | "done";
  raisedBy: string;
  photoUrl: string | null;
};

export function TaskBlock({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function mark(id: string, status: "doing" | "done") {
    setBusy(id);
    try {
      await fetch("/api/admin/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "status", id, status }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (tasks.length === 0) return null;
  const left = tasks.filter((t) => t.status !== "done").length;

  return (
    <section className="mb-6">
      <h2 className="mb-2.5 flex flex-wrap items-baseline gap-x-3 rounded-lg bg-amber-500 px-4 py-2.5 text-white">
        <span className="text-xl font-black uppercase tracking-wide">Jobs for you</span>
        <span className="ml-auto text-sm font-bold">{left} left</span>
      </h2>
      <div className="space-y-2.5">
        {tasks.map((t) => {
          const done = t.status === "done";
          return (
            <article
              key={t.id}
              className={`flex overflow-hidden rounded-xl border bg-white ${
                done ? "border-amber-100 opacity-70" : "border-amber-300"
              }`}
            >
              <span className="w-1.5 shrink-0 bg-amber-500" />
              <div className="min-w-0 flex-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                    {t.kind}
                  </span>
                  {t.dueTime && (
                    <span className="text-2xl font-black leading-none text-[#26364d]">
                      {t.dueTime}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-base font-bold leading-snug text-[#26364d]">
                  {t.description}
                </p>
                <p className="mt-1 text-xs text-[#8a9099]">asked by {t.raisedBy}</p>

                {t.photoUrl && (
                  <a
                    href={t.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-[#8a6a2e]"
                  >
                    See the photo
                  </a>
                )}

                {t.status === "open" && (
                  <button
                    onClick={() => mark(t.id, "doing")}
                    disabled={!!busy}
                    className="mt-2 w-full rounded-lg bg-[#26364d] py-3 text-base font-black uppercase tracking-wider text-white active:bg-[#3f4f61] disabled:opacity-50"
                  >
                    {busy === t.id ? "…" : "Start"}
                  </button>
                )}

                {t.status === "doing" && (
                  <button
                    onClick={() => mark(t.id, "done")}
                    disabled={!!busy}
                    className="mt-2 w-full rounded-lg bg-emerald-600 py-3 text-base font-black uppercase tracking-wider text-white active:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy === t.id ? "…" : "Done"}
                  </button>
                )}

                {done && (
                  <p className="mt-2 text-center text-sm font-bold uppercase tracking-wider text-emerald-700">
                    ✓ Done
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
