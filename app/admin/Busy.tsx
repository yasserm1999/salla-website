"use client";

import { useEffect, useState } from "react";

/**
 * Proof that a tap landed.
 *
 * Every button here sends something to the server and then waits for the page
 * to redraw, which on the dashboard takes seconds. Without a sign in between,
 * people tap again — and a second "Done" or a second allocation is worse than
 * waiting. So any request this part of the site makes shows "Saving…" until
 * it answers, and a save that worked says so.
 *
 * Done by watching fetch rather than by touching every button, so nothing
 * added later can forget to do it. Page refreshes go through fetch too, which
 * is why the bar stays up until the new page is actually on screen.
 */
export function Busy() {
  const [saving, setSaving] = useState(0);
  const [loading, setLoading] = useState(0);
  const pending = saving + loading;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      // Our own saves, and the redraw that follows them. Name lookups in the
      // background are left alone, or the bar would never go away.
      const save = method === "POST" && url.includes("/api/admin/") && !url.includes("/api/admin/customers");
      const redraw = !url.includes("/api/");
      const count = save ? setSaving : redraw ? setLoading : null;

      count?.((n) => n + 1);
      try {
        const res = await original(...args);
        if (save && res.ok) setSaved(true);
        return res;
      } finally {
        count?.((n) => Math.max(0, n - 1));
      }
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  // "Saved" stays until the page has finished redrawing, then a moment more.
  useEffect(() => {
    if (!saved || pending > 0) return;
    const timer = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(timer);
  }, [saved, pending]);

  return (
    <>
      {pending > 0 && <div className="salla-busy-bar fixed inset-x-0 top-0 z-50 h-1 bg-[#b9925d]" />}
      {(pending > 0 || saved) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg ${
              saving === 0 && saved ? "bg-emerald-600" : "bg-[#26364d]"
            }`}
          >
            {saving > 0 ? "Saving…" : saved ? (loading > 0 ? "✓ Saved · updating…" : "✓ Saved") : "Loading…"}
          </span>
        </div>
      )}
    </>
  );
}
