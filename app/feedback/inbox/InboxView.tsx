"use client";

import { useMemo, useState } from "react";
import { Star, Lock, RefreshCw, Download, MessageCircle, Phone } from "lucide-react";

type Entry = {
  id: string;
  created_at: string;
  rating_quality: number | null;
  rating_service: number | null;
  recommend: string | null;
  remarks: string | null;
  name: string | null;
  phone: string | null;
  language: string;
};

const RECOMMEND_LABEL: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

const RECOMMEND_TONE: Record<string, string> = {
  yes: "bg-[#dff0e4] text-[#2f6b42]",
  maybe: "bg-[#fdf3da] text-[#8a6a1f]",
  no: "bg-[#fdf2f0] text-[#a4503c]",
};

/** Compact star row used inside each response. */
function Stars({ value, size = "h-4 w-4" }: { value: number | null; size?: string }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${
            n <= (value ?? 0) ? "fill-[#e0a33e] text-[#e0a33e]" : "text-[#dbe2e8]"
          }`}
        />
      ))}
    </span>
  );
}

function average(values: (number | null)[]): { mean: number; count: number } {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return { mean: 0, count: 0 };
  return { mean: nums.reduce((s, n) => s + n, 0) / nums.length, count: nums.length };
}

/** Headline average with its own star row and distribution bars. */
function ScorePanel({
  title,
  entries,
  pick,
}: {
  title: string;
  entries: Entry[];
  pick: (e: Entry) => number | null;
}) {
  const { mean, count } = average(entries.map(pick));
  const counts = [1, 2, 3, 4, 5].map((n) => entries.filter((e) => pick(e) === n).length);

  return (
    <div className="rounded-[24px] bg-white/90 p-5 shadow-xl backdrop-blur md:p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#546d83]">{title}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-[#26364d]">{mean.toFixed(1)}</span>
        <span className="text-sm text-[#546d83]">
          from {count} response{count === 1 ? "" : "s"}
        </span>
      </p>
      <div className="mt-2">
        <Stars value={Math.round(mean)} size="h-5 w-5" />
      </div>

      <div className="mt-4 space-y-1">
        {[5, 4, 3, 2, 1].map((n) => {
          const c = counts[n - 1];
          const pct = count ? (c / count) * 100 : 0;
          return (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-[#546d83]">{n}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8edf1]">
                <span
                  className="block h-full rounded-full bg-[#e0a33e]"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-6 text-end text-[#546d83]">{c}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InboxView() {
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "lowQuality" | "lowService" | "withPhone">("all");

  const load = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.message || "Could not load the feedback.");
        setEntries(null);
        return;
      }
      setEntries(data.entries as Entry[]);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const promoterPct = useMemo(() => {
    if (!entries || entries.length === 0) return 0;
    return Math.round(
      (entries.filter((e) => e.recommend === "yes").length / entries.length) * 100
    );
  }, [entries]);

  const visible = useMemo(() => {
    if (!entries) return [];
    if (filter === "lowQuality") return entries.filter((e) => (e.rating_quality ?? 5) <= 3);
    if (filter === "lowService") return entries.filter((e) => (e.rating_service ?? 5) <= 3);
    if (filter === "withPhone") return entries.filter((e) => !!e.phone);
    return entries;
  }, [entries, filter]);

  const exportCsv = () => {
    if (!entries) return;
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ["Date", "Cleaning quality", "Customer service", "Recommend", "Remarks", "Name", "Phone", "Language"],
      ...entries.map((e) => [
        new Date(e.created_at).toLocaleString(),
        e.rating_quality ?? "",
        e.rating_service ?? "",
        e.recommend ?? "",
        e.remarks ?? "",
        e.name ?? "",
        e.phone ?? "",
        e.language,
      ]),
    ];
    // BOM so Excel opens the Arabic remarks correctly.
    const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salla-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Password gate ──
  if (!entries) {
    return (
      <form
        onSubmit={load}
        className="mx-auto max-w-md rounded-[30px] bg-white/90 p-8 shadow-2xl backdrop-blur md:p-10"
      >
        <Lock className="mx-auto h-10 w-10 text-[#26364d]" />
        <h2 className="mt-4 text-center text-2xl font-bold text-[#26364d]">Feedback inbox</h2>
        <p className="mt-2 text-center text-sm text-[#546d83]">
          Enter the inbox password to read customer responses.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="mt-6 w-full rounded-2xl border border-[#d8e1e7] bg-white px-4 py-3 text-base text-[#26364d] outline-none transition focus:border-[#26364d]"
        />

        {error && (
          <p className="mt-3 rounded-2xl bg-[#fdf2f0] px-4 py-3 text-sm font-semibold text-[#a4503c]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-5 w-full rounded-2xl bg-[#26364d] px-6 py-4 text-base font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? "Opening…" : "Open inbox"}
        </button>
      </form>
    );
  }

  // ── Inbox ──
  return (
    <div className="space-y-6">
      {entries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <ScorePanel
            title="Cleaning quality"
            entries={entries}
            pick={(e) => e.rating_quality}
          />
          <ScorePanel
            title="Customer service"
            entries={entries}
            pick={(e) => e.rating_service}
          />
          <div className="flex flex-col justify-center rounded-[24px] bg-white/90 p-5 text-center shadow-xl backdrop-blur md:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#546d83]">
              Would recommend
            </p>
            <p className="mt-2 text-5xl font-bold text-[#26364d]">{promoterPct}%</p>
            <p className="mt-2 text-sm text-[#546d83]">
              {entries.length} response{entries.length === 1 ? "" : "s"} in total
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", `All (${entries.length})`],
            ["lowQuality", "Low cleaning score"],
            ["lowService", "Low service score"],
            ["withPhone", "Left a phone number"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              filter === key
                ? "bg-[#26364d] text-white"
                : "border border-[#d8e1e7] bg-white text-[#26364d]"
            }`}
          >
            {label}
          </button>
        ))}

        <div className="ms-auto flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl border border-[#d8e1e7] bg-white px-4 py-2 text-sm font-semibold text-[#26364d] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-2xl border border-[#d8e1e7] bg-white px-4 py-2 text-sm font-semibold text-[#26364d]"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[30px] bg-white/90 p-10 text-center text-[#546d83] shadow-2xl backdrop-blur">
          {entries.length === 0 ? "No responses yet." : "Nothing matches that filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((e) => (
            <div
              key={e.id}
              className="rounded-[24px] bg-white/90 p-5 shadow-xl backdrop-blur md:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#546d83]">Cleaning</span>
                    <Stars value={e.rating_quality} />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#546d83]">Service</span>
                    <Stars value={e.rating_service} />
                  </span>
                  {e.recommend && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        RECOMMEND_TONE[e.recommend] ?? "bg-[#eef2f5] text-[#546d83]"
                      }`}
                    >
                      {RECOMMEND_LABEL[e.recommend] ?? e.recommend}
                    </span>
                  )}
                  <span className="rounded-full bg-[#eef2f5] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#546d83]">
                    {e.language}
                  </span>
                </div>

                <span className="text-xs text-[#8fa3b3]">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>

              {e.remarks && (
                <p
                  dir={e.language === "ar" ? "rtl" : "ltr"}
                  className="mt-3 whitespace-pre-wrap text-base leading-7 text-[#26364d]"
                >
                  {e.remarks}
                </p>
              )}

              {(e.name || e.phone) && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#eef2f5] pt-3 text-sm">
                  {e.name && <span className="font-semibold text-[#26364d]">{e.name}</span>}
                  {e.phone && (
                    <>
                      <span className="flex items-center gap-1.5 text-[#546d83]" dir="ltr">
                        <Phone className="h-4 w-4" />
                        {e.phone}
                      </span>
                      <a
                        href={`https://wa.me/${e.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-xl bg-[#26364d] px-3 py-1.5 text-xs font-semibold text-white transition hover:scale-[1.03]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
