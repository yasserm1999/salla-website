"use client";

import { useState } from "react";
import Link from "next/link";
import type { AgendaItem } from "@/lib/meeting";
import type { Mood } from "@/lib/office";

/**
 * The morning meeting's agenda, on one board.
 *
 * It is always on the page, meeting or not: the owner may want the seven
 * answers without watching anybody walk to a table. During the meeting the
 * point being discussed is lit and opened.
 */

const LIGHT: Record<Mood, string> = {
  alert: "bg-red-600",
  busy: "bg-amber-500",
  calm: "bg-emerald-500",
};

const BAR: Record<Mood, string> = {
  alert: "border-red-500",
  busy: "border-amber-400",
  calm: "border-emerald-400",
};

export function AgendaBoard({
  agenda,
  current,
  presenters,
}: {
  agenda: AgendaItem[];
  current: string | null;
  presenters: Record<string, string>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="mt-4 rounded-2xl border-2 border-[#26364d] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[#26364d]">Morning meeting agenda</h2>
        <span className="text-xs text-[#8a9099]">yesterday, and the shop as it stands now</span>
      </div>
      <ol className="space-y-2">
        {agenda.map((item) => {
          const lit = current === item.key;
          const expanded = lit || open[item.key];
          return (
            <li
              key={item.key}
              className={`rounded-xl border-l-4 bg-[#fbf9f6] p-3 transition-colors ${BAR[item.mood]} ${
                lit ? "bg-[#f8f1e7] ring-2 ring-[#d8b98a]" : ""
              }`}
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [item.key]: !o[item.key] }))}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#26364d] text-sm font-black text-white">
                  {item.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-bold text-[#26364d]">{item.title}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${LIGHT[item.mood]}`} />
                    <span className="text-xs text-[#8a9099]">{presenters[item.presenter] ?? ""}</span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-[#3f4f61]">{item.headline}</span>
                </span>
                {item.lines.length > 0 && (
                  <span className="shrink-0 text-xs font-semibold text-[#546d83]">
                    {expanded ? "Hide" : `${item.lines.length} details`}
                  </span>
                )}
              </button>

              {expanded && (
                <div className="mt-2 ps-10">
                  {item.lines.length > 0 && (
                    <ul className="space-y-1">
                      {item.lines.map((l, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LIGHT[l.mood ?? "calm"]}`}
                          />
                          <span className="min-w-0">
                            <span className="font-semibold text-[#26364d]">{l.text}</span>
                            {l.detail && <span className="block text-xs text-[#8a9099]">{l.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.note && <p className="mt-2 text-xs italic text-[#8a9099]">{item.note}</p>}
                  {item.href && (
                    <Link
                      href={item.href}
                      className="mt-2 inline-block text-xs font-bold text-[#b9925d] hover:underline"
                    >
                      Open the full page →
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
