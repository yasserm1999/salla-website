import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import {
  fetchOrders,
  fetchCustomerNames,
  buildBoard,
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
 * customer's errand. So the top of this page is only ever orders that are
 * still to be cleaned.
 */
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const { from, to } = defaultWindow();

  try {
    const orders = await fetchOrders(from, to);
    const board = buildBoard(orders);

    /*
      Names cost one request each, so they are fetched only for the orders the
      shop still owes work on — the ones somebody might have to ring about.
      The rack can run to fifty bags and nobody is calling those today.
    */
    const needNames = [
      ...board.groups.late,
      ...board.groups.today,
      ...board.groups.soon,
    ].map((o) => o.customerID);

    const names = await fetchCustomerNames(needNames);
    for (const key of ["late", "today", "soon"] as const) {
      board.groups[key] = board.groups[key].map((o) => ({
        ...o,
        customerName: names.get(o.customerID) ?? null,
      }));
    }

    return <Board board={{ ...board, windowFrom: from, windowTo: to }} admin={admin} />;
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
