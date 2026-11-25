"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { whatsappNumber, type Desk, type Mood, type Task } from "@/lib/office";
import type { AgendaItem } from "@/lib/meeting";
import { Floor } from "./Floor";
import { AgendaBoard } from "./AgendaBoard";

/**
 * The office floor: one desk per worker, the manager's at the top.
 *
 * Each desk wears the dashboard's traffic lights — red needs you now, amber
 * has work in it, green is quiet — so the floor can be read from across the
 * room before a single word of it is.
 */

const LIGHT: Record<Mood, { dot: string; ring: string; label: string }> = {
  alert: { dot: "bg-red-600", ring: "border-red-300", label: "Needs you" },
  busy: { dot: "bg-amber-500", ring: "border-amber-300", label: "Working" },
  calm: { dot: "bg-emerald-500", ring: "border-[#ece7e1]", label: "All clear" },
};

const TASK_BAR: Record<Mood, string> = {
  alert: "bg-red-600",
  busy: "bg-amber-500",
  calm: "bg-emerald-500",
};

const button =
  "rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]";

export function Office({
  desks,
  agenda,
  generatedAt,
  admin,
}: {
  desks: Desk[];
  agenda: AgendaItem[];
  generatedAt: string;
  admin: string;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [view, setView] = useState<"floor" | "list">("floor");
  const [selected, setSelected] = useState<string | null>(null);
  const [manager, ...floor] = desks;
  const picked = desks.find((d) => d.key === selected) ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-[#ece7e1] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Virtual office</h1>
          <p className="text-sm text-[#8a9099]">
            {floor.length + 1} workers · read{" "}
            {/* Pinned locale and zone, so the server and the phone print the same time. */}
            {new Date(generatedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Muscat",
            })}
            <span className="hidden sm:inline"> · signed in as {admin}</span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex overflow-hidden rounded-lg border border-[#d8cbbd] text-sm font-semibold">
            {(["floor", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 ${
                  view === v ? "bg-[#26364d] text-white" : "text-[#546d83] hover:text-[#b9925d]"
                }`}
              >
                {v === "floor" ? "Floor" : "List"}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-[#d8cbbd] text-sm font-semibold">
            {(["ar", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-2 ${
                  lang === l ? "bg-[#26364d] text-white" : "text-[#546d83] hover:text-[#b9925d]"
                }`}
                title="Language of the customer messages"
              >
                {l === "ar" ? "عربي" : "English"}
              </button>
            ))}
          </div>
          <Link href="/admin" className={button}>
            Dashboard
          </Link>
          <button onClick={() => router.refresh()} className={button}>
            Refresh
          </button>
        </div>
      </header>

      {view === "floor" ? (
        <>
          {picked && (
            <div className="mb-4">
              {/* Keyed so a new worker opens fresh rather than inheriting "show all". */}
              <DeskCard key={picked.key} desk={picked} lang={lang} wide />
            </div>
          )}
          <Floor desks={desks} agenda={agenda} selected={selected} onSelect={setSelected} />
        </>
      ) : (
        <>
          <AgendaBoard
            agenda={agenda}
            current={null}
            presenters={Object.fromEntries(desks.map((d) => [d.key, d.title]))}
          />
          <div className="mt-4" />
          <DeskCard desk={manager} lang={lang} wide />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {floor.map((d) => (
              <DeskCard key={d.key} desk={d} lang={lang} />
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-[#8a9099]">
        The workers read CleanCloud and the shop&apos;s own lists each time this page opens. They
        never send anything: a WhatsApp button opens the chat with the message written, and you
        press send.
      </p>
    </main>
  );
}

function DeskCard({ desk, lang, wide }: { desk: Desk; lang: "ar" | "en"; wide?: boolean }) {
  const [open, setOpen] = useState(wide ?? false);
  const light = LIGHT[desk.mood];
  const shown = open ? desk.tasks : desk.tasks.slice(0, 3);

  return (
    <section
      id={`desk-${desk.key}`}
      className={`scroll-mt-4 rounded-2xl border-2 bg-white p-4 shadow-sm ${light.ring}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-black ${
              wide ? "bg-[#26364d] text-white" : "bg-[#f8f1e7] text-[#b9925d]"
            }`}
          >
            {desk.badge}
          </div>
          <span
            className={`absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${light.dot}`}
            title={light.label}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <h2 className="text-base font-bold text-[#26364d]">{desk.title}</h2>
            <span className="text-xs font-semibold text-[#8a9099]">{light.label}</span>
          </div>
          <p className="text-xs text-[#8a9099]">{desk.role}</p>
          <p className="mt-2 text-sm leading-relaxed text-[#3f4f61]">{desk.headline}</p>
        </div>
      </div>

      {desk.problem && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {desk.problem}
        </p>
      )}

      {desk.tasks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {shown.map((t) => (
            <TaskRow key={t.id} task={t} lang={lang} />
          ))}
        </ul>
      )}

      {desk.tasks.length > 3 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-xs font-semibold text-[#546d83] hover:text-[#b9925d]"
        >
          {open ? "Show fewer" : `Show all ${desk.tasks.length}`}
        </button>
      )}
    </section>
  );
}

function TaskRow({ task, lang }: { task: Task; lang: "ar" | "en" }) {
  const [copied, setCopied] = useState(false);
  const text = task.draft?.[lang];
  const wa = whatsappNumber(task.person?.tel ?? null);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // A browser that refuses the clipboard still shows the words to select.
    }
  };

  const body = (
    <>
      <p className="text-sm font-semibold text-[#26364d]">{task.text}</p>
      {task.detail && <p className="text-xs text-[#8a9099]">{task.detail}</p>}
    </>
  );

  return (
    <li className="flex gap-2 rounded-xl border border-[#ece7e1] bg-[#fbf9f6] p-2.5">
      <span className={`mt-1 w-1 shrink-0 self-stretch rounded-full ${TASK_BAR[task.mood]}`} />
      <div className="min-w-0 flex-1">
        {task.href && !text ? (
          <Link href={task.href} className="block hover:opacity-80">
            {body}
          </Link>
        ) : (
          body
        )}

        {text && (
          <div className="mt-2">
            <p
              dir={lang === "ar" ? "rtl" : "ltr"}
              className="rounded-lg bg-white p-2 text-xs leading-relaxed text-[#3f4f61] ring-1 ring-[#ece7e1]"
            >
              {text}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {wa ? (
                <a
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Open in WhatsApp
                </a>
              ) : (
                <span className="rounded-lg bg-[#f1ece5] px-3 py-1.5 text-xs text-[#8a9099]">
                  No phone number on file
                </span>
              )}
              <button
                onClick={copy}
                className="rounded-lg border border-[#d8cbbd] px-3 py-1.5 text-xs font-semibold text-[#546d83] hover:border-[#d8b98a]"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              {task.person?.tel && (
                <a
                  href={`tel:${task.person.tel.replace(/[^\d+]/g, "")}`}
                  className="rounded-lg border border-[#d8cbbd] px-3 py-1.5 text-xs font-semibold text-[#546d83] hover:border-[#d8b98a]"
                >
                  Call
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
