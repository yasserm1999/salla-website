"use client";

import { createContext, useContext, useState } from "react";
import { AREAS, AREA_SKIN, areaName } from "@/lib/areas";

/**
 * A customer's delivery area, shown wherever they appear, and set by tapping.
 *
 * The numbers come down once per page in a provider rather than threaded
 * through every list, and a change is kept here as soon as it saves — the
 * dashboard takes seconds to reload from CleanCloud, and nobody should wait
 * that long to see the number they just picked.
 */

export type AreaBook = {
  /** Area by the shop's own customer id. */
  byPerson: Record<string, number>;
  /** Area by CleanCloud customer number, for deliveries. */
  byCleanCloud: Record<string, number>;
  /** False until supabase/areas.sql has been run. */
  ready: boolean;
};

type Ctx = AreaBook & {
  canEdit: boolean;
  save: (who: Who, area: number | null) => Promise<string | null>;
};

type Who = { personId?: string | null; cleanCloudId?: string | null; name?: string | null };

const AreaContext = createContext<Ctx | null>(null);

export function AreaProvider({
  book,
  canEdit,
  children,
}: {
  book: AreaBook;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const [byPerson, setByPerson] = useState(book.byPerson);
  const [byCleanCloud, setByCleanCloud] = useState(book.byCleanCloud);

  async function save(who: Who, area: number | null): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "area", ...who, area }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return data?.error ?? "That did not save.";
    } catch {
      return "Could not reach the server.";
    }
    const put = (map: Record<string, number>, key: string) => {
      const next = { ...map };
      if (area === null) delete next[key];
      else next[key] = area;
      return next;
    };
    if (who.personId) setByPerson((m) => put(m, who.personId!));
    if (who.cleanCloudId) setByCleanCloud((m) => put(m, who.cleanCloudId!));
    return null;
  }

  return (
    <AreaContext.Provider value={{ byPerson, byCleanCloud, ready: book.ready, canEdit, save }}>
      {children}
    </AreaContext.Provider>
  );
}

/** The area for a customer, by whichever id is to hand. */
export function useArea(who: Who): number | null {
  const ctx = useContext(AreaContext);
  if (!ctx) return null;
  return (
    (who.personId ? ctx.byPerson[who.personId] : undefined) ??
    (who.cleanCloudId ? ctx.byCleanCloud[who.cleanCloudId] : undefined) ??
    null
  );
}

export function AreaTag({
  personId,
  cleanCloudId,
  name,
  big = false,
}: Who & { big?: boolean }) {
  const ctx = useContext(AreaContext);
  const area = useArea({ personId, cleanCloudId });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ctx || !ctx.ready || (!personId && !cleanCloudId)) return null;
  if (!area && !ctx.canEdit) return null;

  const size = big ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]";

  async function pick(n: number | null) {
    setBusy(true);
    setError(null);
    const problem = await ctx!.save({ personId, cleanCloudId, name }, n);
    setBusy(false);
    if (problem) setError(problem);
    else setOpen(false);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (ctx.canEdit) setOpen((v) => !v);
        }}
        title={area ? areaName(area) : "Set the area"}
        className={`rounded font-black uppercase tracking-wide ${size} ${
          area
            ? `${AREA_SKIN[area]} text-white`
            : "border border-dashed border-[#d8cbbd] font-bold normal-case tracking-normal text-[#8a9099]"
        }`}
      >
        {area ? `Area ${area}` : "+ area"}
        {area && big && <span className="ms-1 font-semibold normal-case">· {areaName(area)}</span>}
      </button>

      {open && (
        <span
          className="flex w-full flex-wrap gap-1 rounded-lg border border-[#ece7e1] bg-white p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {AREAS.map((a) => (
            <button
              type="button"
              key={a.n}
              disabled={busy}
              onClick={() => pick(a.n)}
              className={`rounded-md px-2 py-1.5 text-left text-xs font-bold text-white disabled:opacity-50 ${AREA_SKIN[a.n]} ${
                area === a.n ? "ring-2 ring-[#26364d] ring-offset-1" : ""
              }`}
            >
              {a.n} · {a.name}
            </button>
          ))}
          {area && (
            <button
              type="button"
              disabled={busy}
              onClick={() => pick(null)}
              className="rounded-md border border-[#d8cbbd] px-2 py-1.5 text-xs font-bold text-[#8a9099] disabled:opacity-50"
            >
              Clear
            </button>
          )}
          {error && <span className="w-full text-xs text-red-700">{error}</span>}
        </span>
      )}
    </span>
  );
}

/** The number alone, for places a tap already means something else. */
export function AreaBadge({ personId, cleanCloudId }: Who) {
  const area = useArea({ personId, cleanCloudId });
  if (!area) return null;
  return (
    <span
      title={areaName(area)}
      className={`rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white ${AREA_SKIN[area]}`}
    >
      Area {area}
    </span>
  );
}
