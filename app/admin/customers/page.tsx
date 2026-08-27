import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { fetchOrders, shopYmd, CleanCloudError } from "@/lib/cleancloud";
import { buildCustomers, summariseCustomers } from "@/lib/customers";
import { loadInvestigations, isSettled } from "@/lib/investigations";
import { Customers, type Row } from "./Customers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — customers" };

/**
 * Rhythm needs history, so this page reads the shop's whole life rather than
 * the dashboard's recent window. It is one request and, at six hundred orders,
 * a cheap one — and an average gap worked out from the last few weeks would
 * mistake every monthly customer for a lapsed one.
 */
const FROM_THE_BEGINNING = "2015-01-01";

export default async function CustomersPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  // The customer book is the owner's. A driver has no reason to see it.
  if (staff.role !== "owner") redirect("/admin");

  try {
    const orders = await fetchOrders(FROM_THE_BEGINNING, shopYmd(new Date()));
    const records = buildCustomers(orders);
    const summary = summariseCustomers(records);
    const store = await loadInvestigations();

    const rows: Row[] = records.map((r) => {
      const mark = store.ready ? store.marks.get(r.id) : undefined;
      const settled = store.ready && isSettled(mark, r.lastOrder);
      return {
        ...r,
        settled,
        settledBy: settled ? (mark?.by ?? null) : null,
        settledAt: settled ? (mark?.at ?? null) : null,
      };
    });

    return (
      <Customers
        rows={rows}
        summary={summary}
        storeReady={store.ready}
        storeProblem={store.ready ? null : store.reason}
        admin={staff.name}
      />
    );
  } catch (e) {
    const message =
      e instanceof CleanCloudError ? e.message : "Something went wrong reading the orders.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-bold text-[#26364d]">Customers</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
      </main>
    );
  }
}
