"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckMark } from "@/lib/quality";

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
    ? `#${order.id} checked by ${mark.staff}${mark.late ? " (late)" : ""}`
    : `Quality check #${order.id}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-black transition ${
          mark
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-[#d8cbbd] bg-white text-[#c4bbb0] hover:border-[#8a9099] hover:text-[#8a9099]"
        }`}
      >
        {mark ? (
          mark.staff.charAt(0).toUpperCase()
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {mark?.late && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
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
        className="w-full max-w-xs rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[#26364d]">{title}</p>
            <p className="truncate text-xs text-[#8a9099]">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-m-1 rounded-lg p-1 text-[#8a9099] hover:text-[#26364d]">
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
        className={`mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-center font-mono text-3xl tracking-[0.6em] text-[#26364d] outline-none ${
          error ? "border-red-400" : "border-[#d8cbbd] focus:border-[#26364d]"
        }`}
      />
      <p className={`mt-2 h-5 text-center text-sm font-bold ${error ? "text-red-700" : "text-[#8a9099]"}`}>
        {busy ? "Checking…" : error ?? ""}
      </p>
    </form>
  );
}

function Checked({ mark, ctx, onDone }: { mark: CheckMark; ctx: QualityContext; onDone: (m: CheckMark | null) => void }) {
  const [fixing, setFixing] = useState(false);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function correct(action: "reassign" | "remove") {
    if (action === "remove" && !confirm("Remove this check? The order will show as not checked.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "correct", checkId: mark.id, action, toStaff: to, reason }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) onDone(data?.mark ?? null);
      else setError(data?.error ?? "Not saved.");
    } catch {
      setError("No connection — nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-xs font-black text-white">
          {mark.staff.charAt(0).toUpperCase()}
        </span>
        <span>
          Checked by <b>{mark.staff}</b>
          <span className="block text-xs">{time(mark.at)}</span>
        </span>
      </p>
      {mark.late && (
        <p className="mt-2 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">
          Late — checked after it was marked ready in CleanCloud.
        </p>
      )}

      {ctx.owner && !fixing && (
        <button onClick={() => setFixing(true)} className="mt-3 text-xs font-bold text-[#546d83] underline underline-offset-2">
          Wrong person?
        </button>
      )}
      {ctx.owner && fixing && (
        <div className="mt-3 space-y-2 border-t border-[#ece7e1] pt-3">
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-[#d8cbbd] bg-white px-2 py-2 text-sm"
          >
            <option value="">It was actually…</option>
            {ctx.staff
              .filter((s) => s !== mark.staff)
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full rounded-lg border border-[#d8cbbd] px-2 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => correct("reassign")}
              disabled={busy || !to}
              className="flex-1 rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Move to {to || "…"}
            </button>
            <button
              onClick={() => correct("remove")}
              disabled={busy}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
          <p className="text-[11px] text-[#8a9099]">Every change is kept in the quality history.</p>
        </div>
      )}
    </div>
  );
}
