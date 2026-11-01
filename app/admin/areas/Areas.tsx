"use client";

import { useState } from "react";
import Link from "next/link";
import { AREAS, AREA_SKIN } from "@/lib/areas";
import { AreaTag, useAreaBook } from "../AreaTag";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  cleanCloudId: string | null;
};

/**
 * The customer book, one tap per customer to give them an area.
 *
 * Opens on the ones still without an area, since that is the work to do; the
 * rest are a filter away for checking or correcting.
 */
export function Areas({ people, back, ready }: { people: Row[]; back: string; ready: boolean }) {
  const book = useAreaBook();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"none" | "all" | number>("none");
  const [limit, setLimit] = useState(50);

  const areaOf = (p: Row) =>
    book.byPerson[p.id] ?? (p.cleanCloudId ? book.byCleanCloud[p.cleanCloudId] : undefined) ?? null;

  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const found = people.filter((p) => {
    const a = areaOf(p);
    if (show === "none" && a !== null) return false;
    if (typeof show === "number" && a !== show) return false;
    if (!needle) return true;
    return (
      p.name.toLowerCase().includes(needle) ||
      (p.address ?? "").toLowerCase().includes(needle) ||
      (p.cleanCloudId ?? "") === needle.replace(/^c/, "") ||
      (digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits))
    );
  });

  const counts = new Map<number | null, number>();
  for (const p of people) counts.set(areaOf(p), (counts.get(areaOf(p)) ?? 0) + 1);

  const chip = (on: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-bold ${on ? "bg-[#26364d] text-white" : "border border-[#d8cbbd] text-[#546d83]"}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Areas</h1>
          <p className="text-sm text-[#8a9099]">
            {people.length - (counts.get(null) ?? 0)} of {people.length} customers have an area
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a]"
        >
          ← {back}
        </Link>
      </header>

      {!ready && (
        <p className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
          Areas are not set up in the database yet — run supabase/areas.sql.
        </p>
      )}

      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(50);
        }}
        placeholder="Search name, phone, address or c-number"
        className="mb-3 w-full rounded-lg border border-[#d8cbbd] bg-white px-3 py-2.5 text-base outline-none focus:border-[#d8b98a]"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button onClick={() => setShow("none")} className={chip(show === "none")}>
          No area ({counts.get(null) ?? 0})
        </button>
        <button onClick={() => setShow("all")} className={chip(show === "all")}>
          All
        </button>
        {AREAS.map((a) => (
          <button
            key={a.n}
            onClick={() => setShow(a.n)}
            title={a.name}
            className={`rounded-lg px-3 py-2 text-sm font-bold ${
              show === a.n ? `${AREA_SKIN[a.n]} text-white` : "border border-[#d8cbbd] text-[#546d83]"
            }`}
          >
            {a.n} ({counts.get(a.n) ?? 0})
          </button>
        ))}
      </div>

      <p className="mb-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#8a9099]">
        {AREAS.map((a) => `${a.n} ${a.name}`).join(" · ")}
      </p>

      {found.length === 0 ? (
        <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-8 text-center text-sm text-[#8a9099]">
          {show === "none" && !needle ? "Every customer has an area." : "Nobody matches."}
        </p>
      ) : (
        <ul className="divide-y divide-[#f0e9df] overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
          {found.slice(0, limit).map((p) => (
            <li key={p.id} className="px-4 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold text-[#26364d]">{p.name}</span>
                {p.cleanCloudId && <span className="font-mono text-xs text-[#b8b1a8]">c{p.cleanCloudId}</span>}
                {p.phone && <span className="text-xs text-[#8a9099]">{p.phone}</span>}
              </div>
              {p.address && <p className="truncate text-xs text-[#8a9099]">{p.address}</p>}
              <div className="mt-1.5">
                <AreaTag personId={p.id} cleanCloudId={p.cleanCloudId} name={p.name} big />
              </div>
            </li>
          ))}
        </ul>
      )}
      {found.length > limit && (
        <button
          onClick={() => setLimit(limit + 50)}
          className="mt-3 w-full rounded-lg border border-[#d8cbbd] py-2.5 text-sm font-bold text-[#546d83]"
        >
          Show more ({found.length - limit} left)
        </button>
      )}
    </main>
  );
}
