"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StockItem } from "@/lib/stock";

/**
 * The shelf.
 *
 * Two taps for what happens most — "I used some" and "more came in" — and
 * everything else out of the way. The count is whatever those entries add up
 * to, so the screen never asks anybody to type a total.
 */

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const MOVE_LABEL = { in: "brought in", used: "used", count: "count corrected" } as const;

export function Stock({
  items,
  owner,
  ready,
  problem,
}: {
  items: StockItem[];
  owner: boolean;
  ready: boolean;
  problem: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/stock", {
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

  const low = items.filter((i) => i.lowAt !== null && i.onHand <= i.lowAt);

  return (
    <section>
      {!ready && (
        <p className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-bold">Stock cannot be saved.</span> {problem}
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

      {low.length > 0 && (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          Running low: {low.map((i) => i.name).join(", ")}
        </p>
      )}

      {adding ? (
        <AddItem busy={busy} send={send} onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mb-4 w-full rounded-lg border-2 border-dashed border-[#d8cbbd] py-3 text-sm font-bold text-[#546d83] hover:border-[#d8b98a]"
        >
          + Add a new item
        </button>
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-8 text-center text-sm text-[#8a9099]">
          Nothing on the list yet.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <ItemCard key={i.id} item={i} owner={owner} busy={busy} send={send} />
          ))}
        </div>
      )}
    </section>
  );
}

type Send = (body: Record<string, unknown>, key: string) => Promise<boolean>;

const isQty = (s: string) => /^\d{1,9}(\.\d{1,3})?$/.test(s.trim()) && Number(s) > 0;

function ItemCard({
  item,
  owner,
  busy,
  send,
}: {
  item: StockItem;
  owner: boolean;
  busy: string | null;
  send: Send;
}) {
  const [mode, setMode] = useState<"used" | "in" | "count" | null>(null);
  const [qty, setQty] = useState("");
  const [why, setWhy] = useState("");
  const [history, setHistory] = useState(false);
  const isLow = item.lowAt !== null && item.onHand <= item.lowAt;
  const unit = item.unit ?? "";

  async function save() {
    if (!mode) return;
    const ok = await send({ what: mode, id: item.id, quantity: qty, note: why }, item.id);
    if (ok) {
      setMode(null);
      setQty("");
      setWhy("");
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white ${isLow ? "border-red-300" : "border-[#ece7e1]"}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-[#26364d]">{item.name}</p>
          {item.lowAt !== null && (
            <p className="text-[11px] text-[#b8b1a8]">
              Low at {item.lowAt} {unit}
            </p>
          )}
        </div>
        <p className={`text-right ${isLow ? "text-red-600" : "text-[#26364d]"}`}>
          <span className="text-2xl font-black tabular-nums">{item.onHand}</span>
          {unit && <span className="ms-1 text-sm font-semibold">{unit}</span>}
          {isLow && <span className="block text-[11px] font-black uppercase tracking-wider">Low</span>}
        </p>
      </div>

      {mode ? (
        <div className="border-t border-[#f0e9df] bg-[#faf7f2] px-4 py-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#546d83]">
            {mode === "used" ? "How many did you use?" : mode === "in" ? "How many came in?" : "How many are really there?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              inputMode="decimal"
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="w-24 rounded-lg border border-[#d8cbbd] px-3 py-2 text-lg font-bold tabular-nums outline-none focus:border-[#d8b98a]"
            />
            {mode !== "count" && (
              <input
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Note (optional)"
                className="min-w-0 flex-1 rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]"
              />
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={save}
              disabled={!!busy || !(mode === "count" ? /^\d{1,9}(\.\d{1,3})?$/.test(qty.trim()) : isQty(qty))}
              className="flex-1 rounded-lg bg-[#26364d] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === item.id ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setMode(null)}
              className="rounded-lg border border-[#d8cbbd] px-4 py-2.5 text-sm font-bold text-[#8a9099]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 border-t border-[#f0e9df] px-4 py-2.5">
          <button
            onClick={() => setMode("used")}
            className="flex-1 rounded-lg bg-[#b9925d] py-2.5 text-sm font-black uppercase tracking-wider text-white active:opacity-80"
          >
            − I used some
          </button>
          <button
            onClick={() => setMode("in")}
            className="flex-1 rounded-lg border border-[#26364d] py-2.5 text-sm font-black uppercase tracking-wider text-[#26364d] active:bg-[#f0e9df]"
          >
            + More came in
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[#f0e9df] px-4 py-2 text-xs">
        <button onClick={() => setHistory(!history)} className="font-semibold text-[#546d83] hover:underline">
          {history ? "Hide history" : "History"}
        </button>
        {owner && (
          <>
            <button onClick={() => setMode("count")} className="font-semibold text-[#546d83] hover:underline">
              Correct the count
            </button>
            <button
              onClick={() => {
                if (confirm(`Take ${item.name} off the list?`)) void send({ what: "remove", id: item.id }, item.id);
              }}
              className="ms-auto font-semibold text-red-600 hover:underline"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {history && (
        <ul className="divide-y divide-[#f0e9df] border-t border-[#f0e9df] bg-[#faf7f2]">
          {item.moves.length === 0 && <li className="px-4 py-2 text-xs text-[#b8b1a8]">Nothing yet.</li>}
          {item.moves.map((m) => (
            <li key={m.id} className="flex items-baseline gap-2 px-4 py-1.5 text-xs">
              <span className={`w-14 font-black tabular-nums ${m.change < 0 ? "text-[#b9925d]" : "text-emerald-700"}`}>
                {m.change > 0 ? "+" : ""}
                {m.change}
              </span>
              <span className="min-w-0 flex-1 text-[#3f4f61]">
                {m.by} {MOVE_LABEL[m.kind]}
                {m.note ? ` — ${m.note}` : ""}
              </span>
              <span className="text-[#b8b1a8]">{when(m.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function AddItem({ busy, send, onDone }: { busy: string | null; send: Send; onDone: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowAt, setLowAt] = useState("");
  const field =
    "w-full rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm outline-none focus:border-[#d8b98a]";
  const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]";

  return (
    <div className="mb-4 rounded-xl border border-[#ece7e1] bg-white p-4">
      <label className="mb-3 block">
        <span className={label}>Item</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Detergent" className={field} />
      </label>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <label>
          <span className={label}>How many now</span>
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className={field} />
        </label>
        <label>
          <span className={label}>Counted in</span>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="bottles" className={field} />
        </label>
        <label>
          <span className={label}>Low at</span>
          <input inputMode="decimal" value={lowAt} onChange={(e) => setLowAt(e.target.value)} placeholder="optional" className={field} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (await send({ what: "item", name, unit, quantity, lowAt }, "item")) onDone();
          }}
          disabled={!!busy || !name.trim()}
          className="flex-1 rounded-lg bg-[#26364d] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "item" ? "Saving…" : "Add item"}
        </button>
        <button onClick={onDone} className="rounded-lg border border-[#d8cbbd] px-4 py-2.5 text-sm font-bold text-[#8a9099]">
          Cancel
        </button>
      </div>
    </div>
  );
}
