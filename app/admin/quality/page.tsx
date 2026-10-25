import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { findChecks, openRequests, qualityShortNames, qualityStaffNames, staffTotals } from "@/lib/quality";
import { Requests } from "./Requests";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — quality" };

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Muscat",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Who checked it.
 *
 * The owner's page, and deliberately small: a box per person with their
 * count, one search box, and the answer. Changes staff have asked for sit on
 * top, and only while there are some.
 */
export default async function QualityPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (staff.role !== "owner") redirect("/admin");

  const q = ((await searchParams).q ?? "").trim();
  const [totals, found, requests] = await Promise.all([staffTotals(), findChecks(q), openRequests()]);
  const short = qualityShortNames();
  const problem = !totals.ready ? totals.reason : !found.ready ? found.reason : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 border-b border-[#ece7e1] pb-4">
        <Link href="/admin" className="text-sm font-semibold text-[#546d83] hover:text-[#b9925d]">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Quality</h1>
      </header>

      {problem && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{problem}</p>}

      <Requests requests={requests.requests} />

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {qualityStaffNames().map((name) => {
          const t = totals.totals.get(name) ?? { count: 0, late: 0 };
          return (
            <div key={name} className="min-w-0 rounded-xl border border-[#ece7e1] bg-white px-4 py-3">
              <p className="flex items-center gap-2 truncate text-base font-bold text-[#26364d]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-black tracking-tight text-white">
                  {short[name]}
                </span>
                {name}
              </p>
              <p className="mt-1.5 text-3xl font-black leading-none text-[#26364d]">{t.count}</p>
              <p className={`mt-1 text-sm font-semibold ${t.late ? "text-orange-700" : "text-[#8a9099]"}`}>{t.late} late</p>
            </div>
          );
        })}
      </section>

      <form method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Customer name, customer no. or order no."
          autoComplete="off"
          enterKeyHint="search"
          // 16px, so an iPhone does not zoom in on it.
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-[#d8cbbd] bg-white px-3 text-base text-[#26364d] outline-none focus:border-[#26364d]"
        />
        <button className="h-12 shrink-0 rounded-xl bg-[#26364d] px-5 text-base font-bold text-white">Search</button>
      </form>

      {q && found.ready && (
        found.found.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#d8cbbd] px-4 py-8 text-center text-base text-[#8a9099]">
            No check found for “{q}”.
          </p>
        ) : (
          <ul className="divide-y divide-[#f0e9df] overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
            {found.found.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 rounded bg-[#26364d] px-1.5 font-mono text-sm font-bold text-white">#{c.orderId}</span>
                    <span className="truncate text-sm font-semibold text-[#26364d]">
                      {c.customerName ?? (c.customerId ? `Customer ${c.customerId}` : "")}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#8a9099]">
                    {stamp(c.checkedAt)}
                    {c.customerId && ` · c${c.customerId}`}
                    {c.late && <span className="ml-1.5 font-bold text-orange-700">late</span>}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-base font-bold text-[#26364d]">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-[11px] font-black tracking-tight text-white">
                    {short[c.staff] ?? c.staff.slice(0, 3).toUpperCase()}
                  </span>
                  {c.staff}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  );
}
