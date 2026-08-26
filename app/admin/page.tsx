import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import {
  fetchOrders,
  fetchCustomers,
  buildBoard,
  buildRuns,
  buildSummary,
  buildDebts,
  fetchTakings,
  monthStart,
  shopYmd,
  defaultWindow,
  CleanCloudError,
} from "@/lib/cleancloud";
import { Board } from "./Board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — shop dashboard" };

/**
 * The shop, sorted by what it still owes.
 *
 * Lateness is measured against work, not collection: once the washing is done
 * the shop has kept its promise, and a bag waiting on the rack is the
 * customer's errand. So the top of this page is only ever orders still to be
 * cleaned — and beside it, the ones a driver has to take out.
 */
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const { from, to } = defaultWindow();

  try {
    const orders = await fetchOrders(from, to);
    const board = buildBoard(orders);
    const runs = buildRuns(orders);
    const debts = buildDebts(orders);

    // Money is read from payments, so the two ranges are asked for separately.
    const today = shopYmd(new Date());
    const [revenueToday, revenueMonth] = await Promise.all([
      fetchTakings(today, today),
      fetchTakings(monthStart(), today),
    ]);
    const summary = buildSummary(orders, board, runs, revenueToday, revenueMonth);

    /*
      Customer records cost one request each and there is no list endpoint, so
      they are fetched only where somebody might act on them: the orders still
      to be washed, and everything a driver has to take out. Nobody is ringing
      the fifty-odd bags waiting on the rack today.
    */
    const needed = [
      ...board.groups.late,
      ...board.groups.today,
      ...board.groups.tomorrow,
      ...board.groups.inTwo,
      ...runs.flatMap((r) => r.stops),
      ...debts.rows,
    ].map((o) => o.customerID);

    const people = await fetchCustomers(needed);
    const dress = <T extends { customerID: string }>(o: T) => {
      const c = people.get(o.customerID);
      return {
        ...o,
        customerName: c?.name ?? null,
        customerTel: c?.tel ?? null,
        customerPlace: c?.place ?? null,
      };
    };

    for (const key of ["late", "today", "tomorrow", "inTwo"] as const) {
      board.groups[key] = board.groups[key].map(dress);
    }
    const dressedRuns = runs.map((r) => ({ ...r, stops: r.stops.map(dress) }));
    const dressedDebts = { ...debts, rows: debts.rows.map(dress) };

    return (
      <Board
        board={{ ...board, windowFrom: from, windowTo: to }}
        runs={dressedRuns}
        debts={dressedDebts}
        summary={summary}
        admin={admin}
      />
    );
  } catch (e) {
    const message =
      e instanceof CleanCloudError ? e.message : "Something went wrong reading the orders.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">Shop dashboard</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          The orders live in CleanCloud, so this page is only as available as they are.
          Nothing is stored here — reload once it answers again.
        </p>
      </main>
    );
  }
}
