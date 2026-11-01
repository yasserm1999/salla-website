import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { shopYmd } from "@/lib/cleancloud";
import { pressingReport, type Pressing } from "@/lib/pressing";
import { PRESSERS } from "@/lib/press-minutes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — pressing" };

/**
 * The day's pressing, person by person.
 *
 * How many orders each presser finished and the minutes those orders were
 * worth — the minutes they claimed by pressing done. Muscat has no daylight
 * saving, so the shop's day is always midnight to midnight at UTC+4.
 */

const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Muscat" });

const dayName = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default async function PressingPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (staff.role !== "owner") redirect("/admin");

  const today = shopYmd(new Date());
  const asked = (await searchParams).day;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;

  const report = await pressingReport(`${day}T00:00:00+04:00`, `${shift(day, 1)}T00:00:00+04:00`);

  const by = (rows: Pressing[], who: string) => rows.filter((r) => r.assignedTo === who);
  const total = (rows: Pressing[]) => rows.reduce((t, r) => t + r.minutes, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Pressing</h1>
          <p className="text-sm text-[#8a9099]">
            {dayName(day)}
            {day === today ? " · today" : ""}
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-[#d8cbbd] px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a]"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <Link href={`/admin/pressing?day=${shift(day, -1)}`} className="rounded-lg border border-[#d8cbbd] px-3 py-1.5 text-sm font-bold text-[#546d83]">
          ← Day before
        </Link>
        {day !== today && (
          <Link href="/admin/pressing" className="rounded-lg bg-[#26364d] px-3 py-1.5 text-sm font-bold text-white">
            Today
          </Link>
        )}
        {day < today && (
          <Link href={`/admin/pressing?day=${shift(day, 1)}`} className="rounded-lg border border-[#d8cbbd] px-3 py-1.5 text-sm font-bold text-[#546d83]">
            Day after →
          </Link>
        )}
      </div>

      {!report.ready && (
        <p className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
          The pressing table could not be read.
        </p>
      )}

      {/* The headline: one tile per presser. */}
      <section className="mb-5 grid grid-cols-2 gap-3">
        {PRESSERS.map((p) => {
          const done = by(report.done, p);
          return (
            <div key={p} className="rounded-xl border border-[#ece7e1] bg-white px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-widest text-[#8a9099]">{p}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-[#26364d]">{hm(total(done))}</p>
              <p className="text-sm font-semibold text-[#546d83]">
                {done.length} order{done.length === 1 ? "" : "s"} pressed
              </p>
            </div>
          );
        })}
      </section>

      {PRESSERS.map((p) => {
        const done = by(report.done, p);
        const open = by(report.open, p);
        return (
          <section key={p} className="mb-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[#26364d]">
              {p} — finished
            </h2>
            {done.length === 0 ? (
              <p className="rounded-xl border border-[#ece7e1] bg-white px-4 py-4 text-center text-sm text-[#8a9099]">
                Nothing finished this day.
              </p>
            ) : (
              <ul className="divide-y divide-[#f0e9df] overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
                {done.map((r) => (
                  <li key={r.orderId} className="flex items-baseline gap-3 px-4 py-2">
                    <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-[#8a9099]">
                      {r.doneAt ? clock(r.doneAt) : ""}
                    </span>
                    <span className="shrink-0 rounded bg-[#26364d] px-1.5 text-sm font-bold text-white">#{r.orderId}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-[#8a9099]">{r.summary}</span>
                    <span className="shrink-0 text-sm font-black tabular-nums text-[#26364d]">{r.minutes} min</span>
                  </li>
                ))}
              </ul>
            )}
            {open.length > 0 && (
              <p className="mt-2 text-xs text-[#546d83]">
                Still with {p}: {open.map((r) => `#${r.orderId} (${r.minutes} min)`).join(", ")}
              </p>
            )}
          </section>
        );
      })}

      <p className="mt-6 text-xs leading-5 text-[#b8b1a8]">
        Minutes are the expected pressing time of each order&rsquo;s garments, credited to the
        person it was allocated to when done is pressed. Times per garment live in
        lib/press-minutes.ts.
      </p>
    </main>
  );
}
