"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckMark, PendingChange } from "@/lib/quality";

/**
 * The circle at the end of an order's line.
 *
 * Grey until somebody checks the bag, then green with their initial. Tapping it
 * asks for the two-digit PIN of whoever is standing at the counter — the login
 * on the tablet says which device, the PIN says which person.
 *
 * Nothing here touches CleanCloud. Marking the order ready there is still what
 * tells the customer.
 */

export type QualityContext = {
  ready: boolean;
  problem: string | null;
  owner: boolean;
  staff: string[];
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Muscat",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const shopDay = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Muscat" }).format(new Date(d)) : null;

export function QualityTick({
  order,
  customerName,
  mark,
  ctx,
  onChange,
}: {
  order: { id: string; customerID: string; createdAt: Date | string | null };
  customerName: string;
  mark: CheckMark | undefined;
  ctx: QualityContext;
  onChange: (orderId: string, mark: CheckMark | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = mark
    ? `#${order.id} checked by ${mark.staff}${mark.late ? " (late)" : ""}${mark.pending ? " — change waiting for approval" : ""}`
    : `Quality check #${order.id}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        /*
          44px: the size a finger finds without looking, on a tablet propped
          on the counter and tapped all day.
        */
        className={`relative grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full border-[3px] text-lg font-black transition active:scale-95 ${
          mark
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-[#cfc3b5] bg-white text-[#b8ada0] hover:border-[#8a9099] hover:text-[#8a9099]"
        } ${mark?.pending ? "ring-4 ring-amber-300" : ""}`}
      >
        {mark ? (
          mark.staff.charAt(0).toUpperCase()
        ) : (
          <svg viewBox="0 0 16 16" className="h-6 w-6" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {mark?.late && (
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-orange-500 ring-2 ring-white" />
        )}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} title={`Order #${order.id}`} subtitle={customerName}>
          {!ctx.ready ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{ctx.problem ?? "Quality checks are not set up."}</p>
          ) : mark ? (
            <Checked
              mark={mark}
              ctx={ctx}
              onDone={(next) => {
                onChange(order.id, next);
                setOpen(false);
              }}
            />
          ) : (
            <PinPad
              order={order}
              customerName={customerName}
              onDone={(m) => {
                onChange(order.id, m);
                setOpen(false);
              }}
            />
          )}
        </Sheet>
      )}
    </>
  );
}

function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  // A sheet from the bottom on a phone, a small card in the middle on anything wider.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#26364d]/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#26364d]">{title}</p>
            <p className="truncate text-sm text-[#8a9099]">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-m-2 grid h-11 w-11 place-items-center rounded-xl text-xl text-[#8a9099] hover:bg-[#f7f3ed] hover:text-[#26364d]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PinPad({
  order,
  customerName,
  onDone,
}: {
  order: { id: string; customerID: string; createdAt: Date | string | null };
  customerName: string;
  onDone: (m: CheckMark) => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  async function send(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          what: "check",
          orderId: order.id,
          takenOn: shopDay(order.createdAt),
          customerId: order.customerID,
          customerName: customerName.startsWith("Customer ") ? null : customerName,
          pin: code,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.mark) onDone(data.mark);
      else {
        setError(data?.error ?? "Not saved — try again.");
        setPin("");
        input.current?.focus();
      }
    } catch {
      setError("No connection — nothing was saved.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.length === 2) void send(pin);
      }}
    >
      <label className="block text-xs font-bold uppercase tracking-widest text-[#8a9099]" htmlFor={`pin-${order.id}`}>
        Your staff code
      </label>
      <input
        ref={input}
        id={`pin-${order.id}`}
        value={pin}
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 2);
          setPin(v);
          setError(null);
          // Two digits is the whole code, so the second one sends it.
          if (v.length === 2) void send(v);
        }}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="••"
        className={`mt-2 w-full rounded-xl border-2 px-3 py-4 text-center font-mono text-4xl tracking-[0.6em] text-[#26364d] outline-none ${
          error ? "border-red-400" : "border-[#d8cbbd] focus:border-[#26364d]"
        }`}
      />
      <p className={`mt-3 h-6 text-center text-base font-bold ${error ? "text-red-700" : "text-[#8a9099]"}`}>
        {busy ? "Checking…" : error ?? ""}
      </p>
    </form>
  );
}

/**
 * A green circle, opened.
 *
 * Staff can ask for it to be put right — it was somebody else, or nobody —
 * with their own code, so the owner knows who is asking. An owner sees what
 * is being asked and says yes or no, or fixes it directly.
 */
function Checked({ mark, ctx, onDone }: { mark: CheckMark; ctx: QualityContext; onDone: (m: CheckMark | null) => void }) {
  const [fixing, setFixing] = useState(false);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: object): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) return data ?? {};
      setError(data?.error ?? "Not saved.");
      return null;
    } catch {
      setError("No connection — nothing was changed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  // The choice is one menu: somebody else's name, or "nobody checked it".
  const action = to === "__remove" ? "remove" : "reassign";
  const toStaff = to === "__remove" ? null : to;

  async function correct() {
    if (action === "remove" && !confirm("Remove this check? The order will show as not checked.")) return;
    const data = await send({ what: "correct", checkId: mark.id, action, toStaff, reason });
    if (data) onDone((data.mark as CheckMark) ?? null);
  }

  async function ask() {
    const data = await send({ what: "request", checkId: mark.id, action, toStaff, reason, pin });
    if (data) onDone({ ...mark, pending: data.pending as PendingChange });
    else setPin("");
  }

  async function decide(approve: boolean) {
    if (!mark.pending) return;
    const data = await send({ what: "decide", requestId: mark.pending.id, approve });
    if (data) onDone((data.mark as CheckMark) ?? null);
  }

  const asked = mark.pending;
  const askedFor = asked
    ? asked.action === "remove"
      ? "remove the check — nobody checked it"
      : `change it to ${asked.toStaff}`
    : "";

  return (
    <div>
      <p className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-base text-emerald-800">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-lg font-black text-white">
          {mark.staff.charAt(0).toUpperCase()}
        </span>
        <span>
          Checked by <b>{mark.staff}</b>
          <span className="block text-sm">{time(mark.at)}</span>
        </span>
      </p>
      {mark.late && (
        <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">
          Late — checked after it was marked ready in CleanCloud.
        </p>
      )}

      {asked && (
        <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p>
            <b>{asked.requestedBy}</b> asked to {askedFor}.
          </p>
          {asked.reason && <p className="mt-1 italic">“{asked.reason}”</p>}
          {ctx.owner ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => decide(true)}
                disabled={busy}
                className="h-12 flex-1 rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-40"
              >
                Approve
              </button>
              <button
                onClick={() => decide(false)}
                disabled={busy}
                className="h-12 flex-1 rounded-xl border-2 border-red-300 bg-white text-base font-bold text-red-700 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          ) : (
            <p className="mt-1 font-semibold">Waiting for the owner to approve.</p>
          )}
        </div>
      )}

      {!asked && !fixing && (
        <button
          onClick={() => setFixing(true)}
          className="mt-3 h-12 w-full rounded-xl border-2 border-[#d8cbbd] text-base font-bold text-[#546d83] hover:border-[#26364d]"
        >
          {ctx.owner ? "Wrong person?" : "Wrong person? Ask to change"}
        </button>
      )}

      {!asked && fixing && (
        <div className="mt-3 space-y-2.5 border-t border-[#ece7e1] pt-3">
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-[#d8cbbd] bg-white px-3 text-base"
          >
            <option value="">It was actually…</option>
            {ctx.staff
              .filter((s) => s !== mark.staff)
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            <option value="__remove">Nobody — remove the check</option>
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-12 w-full rounded-xl border-2 border-[#d8cbbd] px-3 text-base"
          />
          {ctx.owner ? (
            <button
              onClick={correct}
              disabled={busy || !to}
              className="h-12 w-full rounded-xl bg-[#26364d] text-base font-bold text-white disabled:opacity-40"
            >
              {action === "remove" ? "Remove the check" : `Change to ${to || "…"}`}
            </button>
          ) : (
            <>
              <input
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 2));
                  setError(null);
                }}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                placeholder="Your code ••"
                className="h-12 w-full rounded-xl border-2 border-[#d8cbbd] px-3 text-center font-mono text-2xl tracking-[0.4em]"
              />
              <button
                onClick={ask}
                disabled={busy || !to || pin.length !== 2}
                className="h-12 w-full rounded-xl bg-[#26364d] text-base font-bold text-white disabled:opacity-40"
              >
                Send to owner for approval
              </button>
            </>
          )}
          {error && <p className="text-sm font-bold text-red-700">{error}</p>}
          <p className="text-xs text-[#8a9099]">Every change is kept in the quality history.</p>
        </div>
      )}
      {asked && error && <p className="mt-2 text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}
