import Link from "next/link";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { checkHistory, qualityStaffNames, type Check } from "@/lib/quality";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — quality history" };

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Muscat",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Who checked what, and when.
 *
 * The owner's page: an order number answers "who looked at this bag", and the
 * filters answer "how is each person doing" — how many they checked, and how
 * many of those came after the customer had already been told it was ready.
 */
export default async function QualityHistory({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; staff?: string; from?: string; to?: string }>;
}) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (staff.role !== "owner") redirect("/admin");

  const p = await searchParams;
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const filter = {
    order: p.order?.trim().replace(/^#/, "") || undefined,
    staff: p.staff && qualityStaffNames().includes(p.staff) ? p.staff : undefined,
    from: day(p.from),
    to: day(p.to),
  };
  const res = await checkHistory(filter);
  const standing = res.checks.filter((c) => !c.removedAt);

  // Everyone on the list, even with nothing yet, so a zero is visible as a zero.
  const names = [...new Set([...qualityStaffNames(), ...standing.map((c) => c.staff)])];
  const totals = names
    .map((name) => {
      const mine = standing.filter((c) => c.staff === name);
      return { name, count: mine.length, late: mine.filter((c) => c.late).length };
    })
    .filter((t) => !filter.staff || t.name === filter.staff);

  const query = new URLSearchParams(
    Object.entries(filter).filter((e): e is [string, string] => !!e[1])
  ).toString();
  const input =
    "w-full rounded-lg border border-[#d8cbbd] bg-white px-3 py-2 text-sm text-[#26364d] outline-none focus:border-[#26364d]";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#ece7e1] pb-4">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-[#546d83] hover:text-[#b9925d]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[#26364d]">Quality history</h1>
        </div>
        <a
          href={`/api/admin/quality/export${query ? `?${query}` : ""}`}
          className="rounded-lg border border-[#d8cbbd] bg-white px-3 py-2 text-sm font-semibold text-[#546d83] hover:border-[#d8b98a] hover:text-[#b9925d]"
        >
          Export to Excel
        </a>
      </header>

      <form method="get" className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-[#ece7e1] bg-white p-3 sm:grid-cols-5">
        <label className="col-span-2 text-xs font-bold text-[#8a9099] sm:col-span-1">
          Order number
          <input name="order" defaultValue={filter.order ?? ""} inputMode="numeric" placeholder="e.g. 4821" className={`${input} mt-1`} />
        </label>
        <label className="col-span-2 text-xs font-bold text-[#8a9099] sm:col-span-1">
          Staff
          <select name="staff" defaultValue={filter.staff ?? ""} className={`${input} mt-1`}>
            <option value="">Everyone</option>
            {qualityStaffNames().map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#8a9099]">
          From
          <input type="date" name="from" defaultValue={filter.from ?? ""} className={`${input} mt-1`} />
        </label>
        <label className="text-xs font-bold text-[#8a9099]">
          To
          <input type="date" name="to" defaultValue={filter.to ?? ""} className={`${input} mt-1`} />
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <button className="flex-1 rounded-lg bg-[#26364d] px-3 py-2 text-sm font-bold text-white">Show</button>
          {query && (
            <Link href="/admin/quality" className="rounded-lg px-2 py-2 text-sm text-[#8a9099] hover:text-[#26364d]">
              Clear
            </Link>
          )}
        </div>
      </form>

      {!res.ready ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{res.reason}</p>
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {totals.map((t) => (
              <Link
                key={t.name}
                href={`/admin/quality?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), staff: t.name })}`}
                className="rounded-xl border border-[#ece7e1] bg-white px-4 py-3 hover:border-[#d8b98a]"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-[#26364d]">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-[11px] font-black text-white">
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                  {t.name}
                </p>
                <p className="mt-1 text-3xl font-black leading-none text-[#26364d]">{t.count}</p>
                <p className={`mt-1 text-xs font-semibold ${t.late ? "text-orange-700" : "text-[#8a9099]"}`}>
                  {t.late} late{t.count ? ` · ${Math.round((t.late / t.count) * 100)}%` : ""}
                </p>
              </Link>
            ))}
          </section>

          <p className="mb-2 text-xs text-[#8a9099]">
            {res.checks.length} check{res.checks.length === 1 ? "" : "s"}
            {res.checks.length !== standing.length && ` · ${res.checks.length - standing.length} withdrawn, not counted`}
            {res.capped && " · showing the newest 5,000 — narrow the dates to see older ones"}
          </p>

          {res.checks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d8cbbd] px-4 py-10 text-center text-sm text-[#8a9099]">
              {filter.order ? `Nobody has checked order #${filter.order}.` : "No checks match."}
            </p>
          ) : (
            <ul className="divide-y divide-[#f0e9df] overflow-hidden rounded-xl border border-[#ece7e1] bg-white">
              {res.checks.map((c) => (
                <Row key={c.id} c={c} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function Row({ c }: { c: Check }) {
  return (
    <li className={`px-4 py-2.5 ${c.removedAt ? "bg-[#f7f3ed] opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/admin/quality?order=${c.orderId}`}
          className="rounded bg-[#26364d] px-1.5 font-mono text-sm font-bold text-white"
        >
          #{c.orderId}
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#26364d]">
          {c.customerName ?? (c.customerId ? `Customer ${c.customerId}` : "—")}
        </span>
        <span className={`text-sm font-bold ${c.removedAt ? "line-through" : ""} text-[#26364d]`}>{c.staff}</span>
        <span className="text-xs text-[#8a9099]">{stamp(c.checkedAt)}</span>
        {c.late && (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-800">
            Late
          </span>
        )}
        {c.removedAt && (
          <span className="rounded bg-[#ece7e1] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#8a9099]">
            Withdrawn
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-[#8a9099]">
        {c.readyAt ? `Marked ready ${stamp(c.readyAt)}` : "Not marked ready when checked"}
        {c.deviceUser && ` · on ${c.deviceUser}'s login`}
      </p>
      {c.corrections.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-l-2 border-[#d8b98a] pl-2 text-xs text-[#546d83]">
          {c.corrections.map((x, i) => (
            <li key={i}>
              {stamp(x.madeAt)} · {x.madeBy}{" "}
              {x.action === "remove" ? `withdrew ${x.fromStaff}'s check` : `moved it from ${x.fromStaff} to ${x.toStaff}`}
              {x.reason && ` — “${x.reason}”`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
