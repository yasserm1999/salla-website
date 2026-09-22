"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, Package, Volume2, VolumeX, WifiOff } from "lucide-react";
import type { Ring } from "@/lib/bell";

/**
 * The bell, heard from inside the shop.
 *
 * Sonu is not looking at this screen — he is at the machines with water
 * running. So the page's real job is to make a noise he cannot miss and keep
 * making it until somebody says they are going out. Everything visual is for
 * the moment after that: who it is, what they are collecting, which rack.
 *
 * Browsers refuse to make noise until the page has been touched once, which
 * is why there is an "Enable sound" button rather than an apology afterwards.
 */

const SECOND = 1000;

export default function BellStaff({
  me,
  rings: first,
  pushKey,
}: {
  me: string;
  rings: Ring[];
  pushKey: string;
}) {
  const [rings, setRings] = useState<Ring[]>(first);
  const [sound, setSound] = useState(false);
  const [push, setPush] = useState<"off" | "on" | "blocked" | "unsupported" | "install">("off");
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const audio = useRef<AudioContext | null>(null);
  const ringing = useRef<ReturnType<typeof setInterval> | null>(null);

  const waiting = rings.filter((r) => !r.ackAt);
  const answered = rings.filter((r) => r.ackAt);

  /* ── The noise ─────────────────────────────────────────────────── */

  const clang = useCallback(() => {
    const ctx = audio.current;
    if (!ctx) return;
    // Two struck tones a fifth apart: a bell, not a beep, and audible over a
    // washing machine without being a siren.
    for (const [freq, delay] of [
      [880, 0],
      [1320, 0.16],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 1.2);
    }
  }, []);

  async function enableSound() {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await ctx.resume();
      audio.current = ctx;
      setSound(true);
      clang();
    } catch {
      setSound(false);
    }
  }

  // Ring while anybody is waiting, and stop the moment nobody is.
  useEffect(() => {
    if (!sound || waiting.length === 0) {
      if (ringing.current) {
        clearInterval(ringing.current);
        ringing.current = null;
      }
      return;
    }
    if (ringing.current) return;
    clang();
    ringing.current = setInterval(clang, 2 * SECOND);
    return () => {
      if (ringing.current) {
        clearInterval(ringing.current);
        ringing.current = null;
      }
    };
  }, [sound, waiting.length, clang]);

  /* ── Keeping up with the car park ──────────────────────────────── */

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/bell/staff", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive) {
          setRings(data.rings ?? []);
          setOffline(false);
        }
      } catch {
        if (alive) setOffline(true);
      }
    };
    const t = setInterval(pull, 3 * SECOND);
    void pull();
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // A tablet on a wall sleeps. Waking up should not mean a stale screen.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") {
        void fetch("/api/bell/staff", { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => setRings(d.rings ?? []))
          .catch(() => setOffline(true));
      }
    };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, []);

  /* ── Being buzzed when the page is not on screen ───────────────── */

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !pushKey) {
      /*
        An iPad in a Safari tab, almost always.

        Apple allows alerts only once the page has been added to the Home
        Screen and opened from there — in a tab there is no PushManager at
        all. That is a different problem from a browser too old to do any of
        this, and it has a remedy the person can follow.
      */
      setPush(onApple() && !installed() ? "install" : "unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register("/bell-sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPush("blocked");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushKey),
        }));
      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await fetch("/api/bell/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "subscribe", subscription: raw, label: navigator.userAgent.slice(0, 100) }),
      });
      setPush("on");
    } catch {
      setPush("blocked");
    }
  }, [pushKey]);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void subscribe();
    }
  }, [subscribe]);

  async function coming(id: string) {
    setBusy(id);
    try {
      await fetch("/api/bell/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "coming", id }),
      });
      setRings((all) =>
        all.map((r) => (r.id === id ? { ...r, ackAt: new Date().toISOString(), ackBy: me } : r))
      );
    } finally {
      setBusy(null);
    }
  }

  const alarm = waiting.length > 0;

  return (
    <main className={`min-h-dvh px-4 py-4 transition-colors ${alarm ? "bg-[#7f1d1d]" : "bg-[#f7f3ed]"}`}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className={`text-xl font-black tracking-tight ${alarm ? "text-white" : "text-[#26364d]"}`}>
            The bell
          </h1>
          <span className={`text-sm ${alarm ? "text-white/70" : "text-[#8a9099]"}`}>· {me}</span>

          {offline && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              No connection
            </span>
          )}

          <div className="ms-auto flex flex-wrap gap-2">
            <button
              onClick={sound ? () => setSound(false) : enableSound}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
                sound
                  ? "bg-emerald-600 text-white"
                  : "bg-[#d8b98a] text-[#26364d] ring-4 ring-[#d8b98a]/40"
              }`}
            >
              {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
              {sound ? "Sound on" : "Enable sound"}
            </button>

            <button
              onClick={subscribe}
              disabled={push === "on"}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                push === "on"
                  ? "bg-emerald-600 text-white"
                  : push === "blocked"
                    ? "bg-red-600 text-white"
                    : push === "install"
                      ? "bg-[#26364d] text-white"
                      : "border border-[#d8cbbd] bg-white text-[#546d83]"
              }`}
            >
              {push === "on"
                ? "Alerts on"
                : push === "blocked"
                  ? "Alerts blocked"
                  : push === "install"
                    ? "Add to Home Screen first"
                    : push === "unsupported"
                      ? "Alerts unavailable"
                      : "Turn on alerts"}
            </button>
          </div>
        </header>

        {!sound && (
          <p className="mb-4 rounded-2xl bg-[#d8b98a] px-4 py-3 text-sm font-bold text-[#26364d]">
            Tap “Enable sound” once so the bell can ring out loud on this device.
          </p>
        )}

        {push === "install" && (
          <div className="mb-4 rounded-2xl border-2 border-[#26364d] bg-white px-4 py-3 text-sm text-[#26364d]">
            <p className="font-bold">To get alerts on this iPad</p>
            <ol className="mt-1.5 list-decimal space-y-1 ps-5 leading-6">
              <li>
                Tap the <strong>Share</strong> button in Safari (the square with an arrow).
              </li>
              <li>
                Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </li>
              <li>Close Safari and open <strong>Salla bell</strong> from the Home Screen.</li>
              <li>
                Tap <strong>Turn on alerts</strong> there, and allow notifications.
              </li>
            </ol>
            <p className="mt-2 text-xs text-[#5b6675]">
              Apple only allows alerts from a Home Screen app, never from a Safari tab. Until
              then this page still rings on its own as long as it is open and sound is enabled.
            </p>
          </div>
        )}

        {push === "blocked" && (
          <p className="mb-4 rounded-2xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Notifications are switched off for this app. Turn them back on in Settings →
            Notifications → Salla bell, then tap “Turn on alerts” again.
          </p>
        )}

        {waiting.length === 0 ? (
          <div className="rounded-3xl border border-[#ece7e1] bg-white px-4 py-16 text-center">
            <BellRing className="mx-auto h-10 w-10 text-[#d8cbbd]" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-lg font-bold text-[#26364d]">Nobody is waiting</p>
            <p className="mt-1 text-sm text-[#8a9099]">
              This screen rings by itself when a customer presses the bell outside.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {waiting.map((r) => (
              <li key={r.id}>
                <Waiting ring={r} busy={busy === r.id} onComing={() => coming(r.id)} />
              </li>
            ))}
          </ul>
        )}

        {answered.length > 0 && (
          <section className="mt-6">
            <h2 className={`mb-2 text-xs font-bold uppercase tracking-widest ${alarm ? "text-white/70" : "text-[#8a9099]"}`}>
              Answered
            </h2>
            <ul className="space-y-1.5">
              {answered.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-baseline gap-x-2 rounded-xl bg-white/90 px-3 py-2 text-sm"
                >
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  <span className="font-semibold text-[#26364d]">
                    {r.customerName ?? r.asked ?? "Customer"}
                  </span>
                  <span className="text-xs text-[#8a9099]">
                    rang {clock(r.at)} · answered {clock(r.ackAt!)} by {r.ackBy} ·{" "}
                    {waitLabel(r.at, r.ackAt!)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Waiting({ ring: r, busy, onComing }: { ring: Ring; busy: boolean; onComing: () => void }) {
  const ready = (r.orders ?? []).filter((o) => o.ready);
  const inWash = (r.orders ?? []).filter((o) => !o.ready);

  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-lg">
      <div className="flex flex-wrap items-baseline gap-x-3 bg-[#26364d] px-4 py-3 text-white">
        <BellRing className="h-5 w-5 animate-pulse" aria-hidden />
        <span className="text-lg font-black">
          {r.customerName ?? (r.asked ? `“${r.asked}”` : "Someone at the door")}
        </span>
        <span className="ms-auto text-sm font-bold tabular-nums">{clock(r.at)}</span>
        <span className="w-full text-xs text-white/70">{ago(r.at)}</span>
      </div>

      <div className="px-4 py-3">
        {r.asked && !r.customerId && (
          <p className="rounded-xl bg-[#f7f3ed] px-3 py-2 text-sm font-semibold text-[#8a6a2e]">
            Customer not found — “{r.asked}”
          </p>
        )}
        {!r.asked && <p className="text-sm text-[#8a9099]">No customer number given.</p>}

        {r.customerId && (r.orders ?? []).length === 0 && (
          <p className="text-sm font-semibold text-[#8a9099]">No active orders.</p>
        )}

        {ready.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-700">
              Ready to collect
            </p>
            <ul className="space-y-1">
              {ready.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5">
                  {/*
                    The rack first and biggest. It is the only thing on this
                    card that decides where his feet go; the order number is
                    what he checks once he is standing there.
                  */}
                  <span
                    className={`grid min-w-20 shrink-0 place-items-center rounded-xl px-2 py-1.5 leading-none ${
                      o.rack ? "bg-[#26364d] text-white" : "border-2 border-dashed border-[#d8cbbd] text-[#8a9099]"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-75">
                      Rack
                    </span>
                    <span className="text-3xl font-black tabular-nums">{o.rack ?? "—"}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-black uppercase text-white">
                        Ready
                      </span>
                      <span className="text-base font-bold text-[#26364d]">#{o.id}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[#5b6675]">
                      {o.pieces} pc{o.pieces === 1 ? "" : "s"}
                      {o.daysOnRack !== null && o.daysOnRack > 0 ? ` · ${o.daysOnRack}d on the rack` : ""}
                      {!o.rack ? " · no rack written on it" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {inWash.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#b9925d]">
              Still being washed
            </p>
            <ul className="space-y-1">
              {inWash.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#f7f3ed] px-3 py-2">
                  <Package className="h-4 w-4 text-[#b9925d]" aria-hidden />
                  <span className="text-sm font-semibold text-[#26364d]">#{o.id}</span>
                  {o.rack && (
                    <span className="rounded border border-[#26364d] px-1.5 py-0.5 text-xs font-black text-[#26364d]">
                      Rack {o.rack}
                    </span>
                  )}
                  <span className="text-xs text-[#5b6675]">
                    {o.pieces} pc{o.pieces === 1 ? "" : "s"} · {dueWord(o.when)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onComing}
          disabled={busy}
          className="mt-3 w-full rounded-2xl bg-emerald-600 py-5 text-xl font-black text-white active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "…" : "COMING"}
        </button>
      </div>
    </article>
  );
}

/* ── Small helpers ───────────────────────────────────────────────── */

const hhmm = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Muscat",
});

const clock = (iso: string) => hhmm.format(new Date(iso));

/** The wash queues name their bands in code; a person reads them in English. */
function dueWord(when: string | null): string {
  switch (when) {
    case "late":
      return "overdue";
    case "today":
      return "due today";
    case "tomorrow":
      return "due tomorrow";
    case "inTwo":
      return "due in 2 days";
    default:
      return "due later";
  }
}

function ago(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

function waitLabel(from: string, to: string): string {
  const seconds = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
  return seconds < 60 ? `${seconds}s wait` : `${Math.round(seconds / 60)} min wait`;
}

/**
 * An Apple device, including the iPads that claim to be Macs.
 *
 * iPadOS reports itself as "Macintosh" in desktop mode, so the user agent
 * alone is not enough; a Mac with a touch screen is the thing that does not
 * exist.
 */
function onApple(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Opened from the Home Screen rather than in a browser tab. */
function installed(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** The VAPID key travels as base64url and the browser wants bytes. */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}
