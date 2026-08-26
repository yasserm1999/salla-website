import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { fetchOrders, buildBoard, defaultWindow, CleanCloudError } from "@/lib/cleancloud";
import { Board } from "./Board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — shop dashboard" };

/**
 * The shop, sorted by what breaks a promise first.
 *
 * Late is the worst thing that can happen; about to be late is the second.
 * A clean bag nobody has collected is money standing still — worth chasing,
 * never worth chasing before a deadline.
 */
export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const { from, to } = defaultWindow();

  try {
    const orders = await fetchOrders(from, to);
    const board = buildBoard(orders);
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
          Nothing here is stored locally — reload once it answers again.
        </p>
      </main>
    );
  }
}
