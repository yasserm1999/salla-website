"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CustomerRecord, CustomerSummary } from "@/lib/customers";

/**
 * The customer book.
 *
 * Two questions, in this order: who has stopped coming, and who is worth the
 * most. The first is the only one that needs acting on today, so it goes
 * first, ranked by what each of them was worth rather than by how overdue they
 * are — a good customer three gaps late matters more than an occasional one
 * who is technically ten.
 */

type Person = { name: string | null; tel: string | null; place: string | null };

/** A record with its investigation state resolved by the server. */
export type Row = CustomerRecord & {
  settled: boolean;
  settledBy: string | null;
  settledAt: string | null;
};

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const days = (n: number) => `${Math.round(n)}d`;

export function Customers({
  rows,
  summary,
  storeReady,
  storeProblem,
  admin,
}: {
  rows: Row[];
  summary: CustomerSummary;
  storeReady: boolean;
  storeProblem: string | null;
  admin: string;
}) {
  const router = useRouter();
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const lapsed = rows.filter((r) => r.lapsed && !r.settled);
  const settled = rows.filter((r) => r.lapsed && r.settled);
  const top = rows.slice(0, 25);

  const lookUp = useCallback(async (ids: string[]) => {
    const wanted = [...new Set(ids.filter(Boolean))].slice(0, 40);
    if (wanted.length === 0) return;
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: wanted }),
      });
      const data = await res.json();
      if (data?.people) setPeople((prev) => ({ ...prev, ...data.people }));
    } catch {
      // The numbers are the point; the names are a convenience on top.
    }
  }, []);

  // Whoever needs ringing gets a name first, then the leaderboard.
  useEffect(() => {
    void lookUp([...lapsed.map((r) => r.id), ...top.map((r) => r.id)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const nameOf = (id: string) => people[id]?.name ?? `Customer ${id}`;
  const telOf = (id: string) => people[id]?.tel ?? null;

  async function mark(row: Row, close: boolean) {
    setBusy(row.id);
    setFailed(null);
    try {
      const res = await fetch("/api/admin/investigations", {
        method: close ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: row.id,
          lastOrderAt: new Date(row.lastOrder).toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setFailed(data?.error ?? "That did not save.");
      else router.refresh();
    } catch {
      setFailed("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#ece7e1] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Customers</h1>
          <p className="text-sm text-[#8a9099]">
            Who is worth the most, and who has quietly stopped coming
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
        >
          ← Shop dashboard
        </Link>
      </header>

      {!storeReady && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-bold">The investigated button will not save yet.</span>{" "}
          {storeProblem} Everything else on this page works.
        </p>
      )}

      {failed && (
        <p className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {failed}
        </p>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-4">
        <Tile label="Customers" value={String(summary.total)} note="ever" />
        <Tile label="Coming regularly" value={String(summary.active)} note="on their own rhythm" />
        <Tile
          label="Stopped coming"
          value={String(lapsed.length)}
          note={lapsed.length ? "need a call" : "nobody outstanding"}
          tone={lapsed.length ? "bad" : "good"}
        />
        <Tile
          label="Value at risk"
          value={money(lapsed.reduce((t, r) => t + r.spent, 0))}
          note="what they used to spend"
          tone={lapsed.length ? "bad" : "good"}
        />
      </section>

      {/* ── The ones who have gone quiet ───────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-red-700">
          Stopped coming — {lapsed.length}
        </h2>
        <p className="mb-3 text-xs text-[#8a9099]">
          Gone for more than three times their own usual gap, and at least a fortnight. Worth the
          most first.
        </p>

        {lapsed.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
            Nobody has gone quiet. Everyone with a rhythm is keeping to it.
          </p>
        ) : (
          <div className="space-y-2.5">
            {lapsed.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-red-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight text-[#26364d]">
                      {nameOf(row.id)}{" "}
                      <span className="text-xs font-medium text-[#b8b1a8]">c{row.id}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-[#546d83]">
                      came every <strong>{days(row.averageGapDays ?? 0)}</strong> · last seen{" "}
                      <strong>{days(row.daysSinceLast)} ago</strong> ·{" "}
                      <span className="font-bold text-red-700">
                        {row.overdue?.toFixed(1)}× their gap
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#8a9099]">
                      {row.orders} orders over {row.visits} visits · {money(row.spent)} spent ·{" "}
                      {money(row.averageOrder)} a time
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                    {telOf(row.id) && (
                      <a
                        href={`tel:${telOf(row.id)!.replace(/[^\d+]/g, "")}`}
                        className="rounded-lg border border-[#546d83] px-3 py-2 text-center text-sm font-bold text-[#546d83] hover:bg-[#e8f0f4]"
                      >
                        Call {telOf(row.id)}
                      </a>
                    )}
                    <button
                      onClick={() => mark(row, true)}
                      disabled={busy === row.id}
                      className="rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white hover:bg-[#3f4f61] disabled:opacity-50"
                    >
                      {busy === row.id ? "Saving…" : "Case investigated"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {settled.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowSettled((v) => !v)}
              className="text-xs font-semibold uppercase tracking-wider text-[#8a9099] hover:text-[#26364d]"
            >
              {showSettled ? "Hide" : "Show"} {settled.length} already investigated
            </button>
            {showSettled && (
              <ul className="mt-2 divide-y divide-[#f0e9df] rounded-xl border border-[#ece7e1] bg-white">
                {settled.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5">
                    <span className="font-semibold text-[#546d83]">{nameOf(row.id)}</span>
                    <span className="text-xs text-[#b8b1a8]">c{row.id}</span>
                    <span className="text-xs text-[#8a9099]">
                      {money(row.spent)} · gone {days(row.daysSinceLast)}
                    </span>
                    <span className="ml-auto text-xs text-[#b8b1a8]">
                      looked at by {row.settledBy}
                      {row.settledAt && ` on ${new Date(row.settledAt).toLocaleDateString()}`}
                    </span>
                    <button
                      onClick={() => mark(row, false)}
                      disabled={busy === row.id}
                      className="text-xs font-semibold text-[#b9925d] hover:underline disabled:opacity-50"
                    >
                      reopen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── The leaderboard ────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-[#26364d]">
          Top customers
        </h2>
        <p className="mb-3 text-xs text-[#8a9099]">By everything they have spent with the shop.</p>

        <div className="overflow-x-auto rounded-xl border border-[#ece7e1] bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-[#ece7e1] text-left text-[0.68rem] uppercase tracking-wider text-[#b8b1a8]">
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-3 py-2.5 text-right font-semibold">Spent</th>
                <th className="px-3 py-2.5 text-right font-semibold">Orders</th>
                <th className="px-3 py-2.5 text-right font-semibold">Average</th>
                <th className="px-3 py-2.5 text-right font-semibold">Comes every</th>
                <th className="px-4 py-2.5 text-right font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e9df]">
              {top.map((row, i) => (
                <tr key={row.id} className={row.lapsed && !row.settled ? "bg-red-50" : ""}>
                  <td className="px-4 py-2.5">
                    <span className="mr-2 text-xs text-[#d8cbbd]">{i + 1}</span>
                    <span className="font-semibold text-[#26364d]">{nameOf(row.id)}</span>
                    <span className="ml-1.5 text-xs text-[#b8b1a8]">c{row.id}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-[#26364d]">
                    {money(row.spent)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#546d83]">
                    {row.orders}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#546d83]">
                    {money(row.averageOrder)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#546d83]">
                    {row.averageGapDays === null ? (
                      <span className="text-[#b8b1a8]">too few visits</span>
                    ) : (
                      days(row.averageGapDays)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={row.lapsed && !row.settled ? "font-bold text-red-700" : "text-[#546d83]"}>
                      {days(row.daysSinceLast)} ago
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-[#b8b1a8]">
        {summary.total} customers · {summary.oneTimers} came once and never returned ·{" "}
        {summary.unknown} have not come often enough to judge · signed in as {admin}
      </p>
    </main>
  );
}

function Tile({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "bad" | "good";
}) {
  const colour = {
    plain: "border-[#ece7e1] bg-white text-[#26364d]",
    bad: "border-red-300 bg-red-50 text-red-700",
    good: "border-emerald-300 bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${colour}`}>
      <p className="text-[0.68rem] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-0.5 text-3xl font-black leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs opacity-70">{note}</p>
    </div>
  );
}
