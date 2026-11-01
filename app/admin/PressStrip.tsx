"use client";

import { createContext, useContext, useState } from "react";
import { PRESSERS, pressLines, pressMinutes } from "@/lib/press-minutes";

/**
 * Pressing, on the order line itself.
 *
 * First the order is allocated — Basel or Sonu — then whoever has it presses
 * done and is credited with its minutes. Kept on the line rather than on a
 * page of its own because the line is where everybody already looks.
 *
 * What is known comes down once in a provider and is updated here as soon as
 * a tap saves; the dashboard takes seconds to reload from CleanCloud and
 * nobody should wait that long to see their own tap land.
 */

export type PressRow = {
  assignedTo: string | null;
  minutes: number;
  doneAt: string | null;
};

type Ctx = {
  rows: Record<string, PressRow>;
  me: string;
  /** Owners and the manager allocate, and can press done for anybody. */
  boss: boolean;
  owner: boolean;
  act: (body: Record<string, unknown>, next: PressRow | null) => Promise<string | null>;
};

const PressContext = createContext<Ctx | null>(null);

export function PressProvider({
  rows: initial,
  me,
  role,
  children,
}: {
  rows: Record<string, PressRow>;
  me: string;
  role: "owner" | "manager" | "driver" | "washer";
  children: React.ReactNode;
}) {
  const [rows, setRows] = useState(initial);

  async function act(body: Record<string, unknown>, next: PressRow | null): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/pressing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "That did not save.";
    } catch {
      return "Could not reach the server.";
    }
    setRows((r) => {
      const copy = { ...r };
      if (next) copy[String(body.orderId)] = next;
      else delete copy[String(body.orderId)];
      return copy;
    });
    return null;
  }

  return (
    <PressContext.Provider
      value={{
        rows,
        me: me.toLowerCase(),
        // The pressers share one screen, so it acts for either of them.
        boss: role === "owner" || role === "manager" || PRESSERS.includes(me.toLowerCase()),
        owner: role === "owner",
        act,
      }}
    >
      {children}
    </PressContext.Provider>
  );
}

const name = (n: string) => n.charAt(0).toUpperCase() + n.slice(1);

export function PressStrip({
  orderId,
  customerId,
  summary,
  quiet = false,
  className = "",
}: {
  orderId: string;
  customerId: string;
  summary: string | null;
  /** Already on the rack: show what happened, but offer nothing new. */
  quiet?: boolean;
  className?: string;
}) {
  const ctx = useContext(PressContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  if (!ctx) return null;

  const row = ctx.rows[orderId];
  const minutes = row?.minutes ?? pressMinutes(summary);
  const unknown = pressLines(summary).some((l) => !l.known);
  const mine = row?.assignedTo === ctx.me;
  const presser = PRESSERS.includes(ctx.me);

  // Nothing to press — towels, socks, carpets — and nobody has it.
  if (minutes === 0 && !row?.assignedTo) return null;
  if (quiet && !row?.assignedTo) return null;

  async function go(body: Record<string, unknown>, next: PressRow | null) {
    setBusy(true);
    setError(null);
    const problem = await ctx!.act({ orderId, customerId, summary, ...body }, next);
    setBusy(false);
    if (problem) setError(problem);
    else setChanging(false);
  }

  const pill = "rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-wide disabled:opacity-50";
  const time = (
    <span className="text-xs font-bold text-[#546d83]" title={unknown ? "Includes items with no set time — counted as 3 min each" : undefined}>
      ~{minutes} min{unknown ? "*" : ""}
    </span>
  );

  let body: React.ReactNode;
  if (row?.doneAt) {
    body = (
      <>
        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
          ✓ Pressed
        </span>
        <span className="text-xs font-semibold text-emerald-800">
          {name(row.assignedTo ?? "")} · {row.minutes} min
        </span>
        {ctx.owner && (
          <button
            disabled={busy}
            onClick={() => go({ what: "undo" }, { ...row, doneAt: null })}
            className="ms-auto text-[11px] font-semibold text-[#8a9099] hover:underline"
          >
            undo
          </button>
        )}
      </>
    );
  } else if (row?.assignedTo && !changing) {
    body = (
      <>
        <span className="text-xs font-bold text-[#26364d]">
          Pressing: <span className="capitalize">{row.assignedTo}</span>
        </span>
        {time}
        <span className="ms-auto flex items-center gap-2">
          {ctx.boss && (
            <button onClick={() => setChanging(true)} className="text-[11px] font-semibold text-[#8a9099] hover:underline">
              change
            </button>
          )}
          {(mine || ctx.boss) && (
            <button
              disabled={busy}
              onClick={() => go({ what: "done" }, { ...row, doneAt: new Date().toISOString() })}
              className={`${pill} bg-emerald-600 text-white`}
            >
              {busy ? "…" : "Done"}
            </button>
          )}
        </span>
      </>
    );
  } else if (ctx.boss) {
    body = (
      <>
        <span className="text-xs font-bold text-[#8a9099]">Press:</span>
        {time}
        <span className="ms-auto flex flex-wrap items-center gap-1.5">
          {PRESSERS.map((p) => (
            <button
              key={p}
              disabled={busy}
              onClick={() => go({ what: "allocate", to: p }, { assignedTo: p, minutes, doneAt: null })}
              className={`${pill} ${
                row?.assignedTo === p ? "bg-[#26364d] text-white" : "border border-[#26364d] text-[#26364d]"
              }`}
            >
              {name(p)}
            </button>
          ))}
          {row?.assignedTo && (
            <button
              disabled={busy}
              onClick={() => go({ what: "allocate", to: null }, null)}
              className="text-[11px] font-semibold text-[#8a9099] hover:underline"
            >
              nobody
            </button>
          )}
          {changing && (
            <button onClick={() => setChanging(false)} className="text-[11px] font-semibold text-[#8a9099] hover:underline">
              cancel
            </button>
          )}
        </span>
      </>
    );
  } else if (presser) {
    body = (
      <>
        <span className="text-xs font-bold text-[#8a9099]">Not allocated</span>
        {time}
        <button
          disabled={busy}
          onClick={() => go({ what: "allocate", to: ctx.me }, { assignedTo: ctx.me, minutes, doneAt: null })}
          className={`${pill} ms-auto border border-[#26364d] text-[#26364d]`}
        >
          {busy ? "…" : "Take it"}
        </button>
      </>
    );
  } else {
    return null;
  }

  return (
    <div
      className={`${className} mt-1.5 rounded-lg px-2.5 py-1.5 ${
        row?.doneAt ? "bg-emerald-50" : row?.assignedTo ? "bg-[#eef2f6]" : "bg-[#faf7f2]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{body}</div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
