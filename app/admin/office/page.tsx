import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import {
  fetchOrders,
  fetchCustomers,
  fetchTakings,
  buildBoard,
  buildRuns,
  buildSummary,
  buildDebts,
  defaultWindow,
  monthStart,
  shopYmd,
  CleanCloudError,
} from "@/lib/cleancloud";
import { buildCustomers, lapsedCustomers } from "@/lib/customers";
import { loadInvestigations, isSettled } from "@/lib/investigations";
import { loadSpan, shiftDay, knownNames } from "@/lib/pickups";
import { buildAgenda, type AgendaItem } from "@/lib/meeting";
import { loadIssues } from "@/lib/issues";
import { loadStock } from "@/lib/stock";
import { buildOffice, peopleWanted, type Desk } from "@/lib/office";
import { Office } from "./Office";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — virtual office" };

/**
 * The whole history is read once, because the marketing desk needs it to tell
 * a lapsed regular from a one-off; everything else is cut from it in memory
 * rather than asked for again.
 */
const FROM_THE_BEGINNING = "2015-01-01";

export default async function OfficePage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  // The office reads the books and the customer book, which are the owner's.
  if (staff.role !== "owner") redirect("/admin");

  const now = new Date();
  const today = shopYmd(now);
  const { from } = defaultWindow(now);

  let desks: Desk[];
  let agenda: AgendaItem[];
  try {
    const history = await fetchOrders(FROM_THE_BEGINNING, today);
    // The dashboard's own window, so both pages count the same orders.
    const orders = history.filter((o) => !o.createdAt || shopYmd(o.createdAt) >= from);

    const board = buildBoard(orders, now);
    const runs = buildRuns(orders, now);
    const debts = buildDebts(orders, now);

    const [revenueToday, revenueMonth, pickups, issues, stock, cases] = await Promise.all([
      fetchTakings(today, today),
      fetchTakings(monthStart(now), today),
      loadSpan(today, shiftDay(today, 1)),
      loadIssues(),
      loadStock(),
      loadInvestigations(),
    ]);
    const summary = buildSummary(orders, board, runs, revenueToday, revenueMonth, now);

    // A customer the owner has already looked into is not news again.
    const lapsed = lapsedCustomers(buildCustomers(history, now)).filter(
      (r) => !(cases.ready && isSettled(cases.marks.get(r.id), r.lastOrder))
    );

    const [people, names] = await Promise.all([
      fetchCustomers(peopleWanted(board, runs, debts, lapsed, today)),
      knownNames(),
    ]);
    // Names the shop has saved, topped up with any just fetched from CleanCloud.
    for (const [id, p] of people) if (p.name && !names[id]) names[id] = p.name;

    const meeting = await buildAgenda({
      now,
      today,
      history,
      board,
      stock: { ready: stock.ready, reason: stock.ready ? undefined : stock.reason, items: stock.items },
      issues: issues.issues,
      names,
    });
    agenda = meeting.agenda;

    desks = buildOffice({
      pressing: meeting.pressing,
      now,
      today,
      board,
      runs,
      summary,
      debts,
      pickups: {
        ready: pickups.ready,
        reason: pickups.ready ? undefined : pickups.reason,
        jobs: pickups.data.jobs.filter((j) => j.status !== "cancelled"),
      },
      issues: {
        ready: issues.ready,
        reason: issues.ready ? undefined : issues.reason,
        issues: issues.issues,
      },
      stock: {
        ready: stock.ready,
        reason: stock.ready ? undefined : stock.reason,
        items: stock.items,
      },
      lapsed,
      people,
    });
  } catch (e) {
    const message =
      e instanceof CleanCloudError ? e.message : "Something went wrong reading the orders.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-bold text-[#26364d]">Virtual office</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
        <p className="mt-3 text-sm text-[#8a9099]">
          Every desk reads from CleanCloud, so the office opens once it answers again.
        </p>
      </main>
    );
  }

  return <Office desks={desks} agenda={agenda} generatedAt={now.toISOString()} admin={staff.name} />;
}
