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
 *
 * Every item carries a photo and a serial, because the person at the shelf
 * knows the box by how it looks or by the number on it, rarely by what
 * somebody once decided to call it.
 */

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const MOVE_LABEL = { in: "brought in", used: "used", count: "count corrected" } as const;

/*
  Shrunk on the phone before it is sent, as on the report form: a picture
  straight off the camera is several megabytes, and a shelf photo needs to be
  recognisable, not printable.
*/
async function shrink(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } catch {
    return null;
  }
}

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
  const [q, setQ] = useState("");

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

  const low = items.filter((i) => !i.pending && i.lowAt !== null && i.onHand <= i.lowAt);
  const waiting = items.filter((i) => i.pending);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? items.filter(
        (i) => i.name.toLowerCase().includes(needle) || (i.serial ?? "").toLowerCase().includes(needle)
      )
    : items;

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

      {owner && waiting.length > 0 && (
        <p className="mb-3 rounded-lg border border-[#d8b98a] bg-[#f8f1e7] px-4 py-2 text-sm font-semibold text-[#b9925d]">
          {waiting.length} new item{waiting.length === 1 ? "" : "s"} waiting for your approval — shown first below.
        </p>
      )}

      {adding ? (
        <AddItem busy={busy} send={send} onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mb-3 w-full rounded-lg border-2 border-dashed border-[#d8cbbd] py-3 text-sm font-bold text-[#546d83] hover:border-[#d8b98a]"
        >
          + Add a new item
        </button>
      )}

      {items.length > 0 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or serial"
          className="mb-3 w-full rounded-lg border border-[#d8cbbd] bg-white px-3 py-2.5 text-base outline-none focus:border-[#d8b98a]"
        />
      )}

      {items.length === 0 ? (
        <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-8 text-center text-sm text-[#8a9099]">
          Nothing on the list yet.
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-8 text-center text-sm text-[#8a9099]">
          Nothing matches &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Waiting ones first, so the owner sees them without searching. */}
          {[...shown.filter((i) => i.pending), ...shown.filter((i) => !i.pending)].map((i) => (
            <ItemCard key={i.id} item={i} owner={owner} busy={busy} send={send} />
          ))}
        </div>
      )}
    </section>
  );
}

type Send = (body: Record<string, unknown>, key: string) => Promise<boolean>;

const isQty = (s: string) => /^\d{1,9}(\.\d{1,3})?$/.test(s.trim()) && Number(s) > 0;

const field =
  "w-full rounded-lg border border-[#d8cbbd] bg-white px-3 py-2 text-sm outline-none focus:border-[#d8b98a]";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8a9099]";

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
  const [mode, setMode] = useState<"used" | "in" | "count" | "edit" | null>(null);
  const [qty, setQty] = useState("");
  const [why, setWhy] = useState("");
  const [history, setHistory] = useState(false);
  const [big, setBig] = useState(false);
  const [shrinking, setShrinking] = useState(false);
  const isLow = item.lowAt !== null && item.onHand <= item.lowAt;
  const unit = item.unit ?? "";

  async function save() {
    if (!mode || mode === "edit") return;
    const ok = await send({ what: mode, id: item.id, quantity: qty, note: why }, item.id);
    if (ok) {
      setMode(null);
      setQty("");
      setWhy("");
    }
  }

  async function photograph(file: File) {
    setShrinking(true);
    const photo = await shrink(file);
    setShrinking(false);
    if (photo) await send({ what: "photo", id: item.id, photo }, item.id);
  }

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white ${isLow ? "border-red-300" : "border-[#ece7e1]"}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {item.photoUrl ? (
          <button onClick={() => setBig(!big)} className="shrink-0" title="Show the photo larger">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.photoUrl}
              alt={item.name}
              className="h-16 w-16 rounded-lg border border-[#ece7e1] object-cover"
            />
          </button>
        ) : (
          <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#d8cbbd] text-center text-[10px] font-bold uppercase leading-tight text-[#8a9099]">
            {shrinking || busy === item.id ? "…" : "+ Photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void photograph(file);
              }}
            />
          </label>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-[#26364d]">{item.name}</p>
          {item.pending && (
            <p className="mt-0.5 inline-block rounded bg-[#b9925d] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              Waiting for approval · added by {item.createdBy}
            </p>
          )}
          {item.serial && (
            <p className="mt-0.5 font-mono text-xs font-bold text-[#546d83]">{item.serial}</p>
          )}
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

      {big && item.photoUrl && (
        <div className="border-t border-[#f0e9df] px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.photoUrl} alt={item.name} className="w-full rounded-lg border border-[#ece7e1]" />
        </div>
      )}

      {mode === "edit" ? (
        <EditItem item={item} busy={busy} send={send} onDone={() => setMode(null)} />
      ) : mode ? (
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
      ) : item.pending ? (
        owner ? (
          <div className="flex gap-2 border-t border-[#f0e9df] px-4 py-2.5">
            <button
              onClick={() => send({ what: "approve", id: item.id }, item.id)}
              disabled={!!busy}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => {
                if (confirm(`Reject ${item.name}? It will be taken off the list.`))
                  void send({ what: "remove", id: item.id }, item.id);
              }}
              disabled={!!busy}
              className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        ) : (
          <p className="border-t border-[#f0e9df] px-4 py-2.5 text-xs text-[#8a9099]">
            Can be used once the owner approves it.
          </p>
        )
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#f0e9df] px-4 py-2 text-xs">
        <button onClick={() => setHistory(!history)} className="font-semibold text-[#546d83] hover:underline">
          {history ? "Hide history" : "History"}
        </button>
        {item.photoUrl && (
          <label className="cursor-pointer font-semibold text-[#546d83] hover:underline">
            {shrinking ? "Preparing…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void photograph(file);
              }}
            />
          </label>
        )}
        {owner && (
          <>
            <button onClick={() => setMode("edit")} className="font-semibold text-[#546d83] hover:underline">
              Edit
            </button>
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

function EditItem({
  item,
  busy,
  send,
  onDone,
}: {
  item: StockItem;
  busy: string | null;
  send: Send;
  onDone: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [serial, setSerial] = useState(item.serial ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [lowAt, setLowAt] = useState(item.lowAt === null ? "" : String(item.lowAt));

  return (
    <div className="border-t border-[#f0e9df] bg-[#faf7f2] px-4 py-3">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label>
          <span className={label}>Item</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label>
          <span className={label}>Serial</span>
          <input value={serial} onChange={(e) => setSerial(e.target.value)} className={field} />
        </label>
        <label>
          <span className={label}>Counted in</span>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className={field} />
        </label>
        <label>
          <span className={label}>Low at</span>
          <input inputMode="decimal" value={lowAt} onChange={(e) => setLowAt(e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (await send({ what: "edit", id: item.id, name, serial, unit, lowAt }, item.id)) onDone();
          }}
          disabled={!!busy || !name.trim() || !serial.trim()}
          className="flex-1 rounded-lg bg-[#26364d] py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === item.id ? "Saving…" : "Save"}
        </button>
        <button onClick={onDone} className="rounded-lg border border-[#d8cbbd] px-4 py-2.5 text-sm font-bold text-[#8a9099]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddItem({ busy, send, onDone }: { busy: string | null; send: Send; onDone: () => void }) {
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lowAt, setLowAt] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [shrinking, setShrinking] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-[#ece7e1] bg-white p-4">
      <div className="mb-3 flex gap-3">
        {photo ? (
          <button onClick={() => setPhoto(null)} className="shrink-0" title="Remove the photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="The item" className="h-20 w-20 rounded-lg border border-[#ece7e1] object-cover" />
          </button>
        ) : (
          <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#d8cbbd] text-center text-xs font-bold uppercase leading-tight text-[#8a9099]">
            {shrinking ? "…" : "+ Photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setShrinking(true);
                setPhoto(await shrink(file));
                setShrinking(false);
              }}
            />
          </label>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block">
            <span className={label}>Item</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Detergent" className={field} />
          </label>
          <label className="block">
            <span className={label}>Serial</span>
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Leave blank to number it automatically"
              className={field}
            />
          </label>
        </div>
      </div>
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
            if (await send({ what: "item", name, serial, unit, quantity, lowAt, photo }, "item")) onDone();
          }}
          disabled={!!busy || shrinking || !name.trim()}
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
