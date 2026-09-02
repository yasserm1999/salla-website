import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { fetchOrders, shopYmd, CleanCloudError } from "@/lib/cleancloud";
import { buildPeriods, likeForLike, SHOP_OPENED } from "@/lib/revenue";
import { Revenue } from "./Revenue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — revenue" };

export default async function RevenuePage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  // The books are the owner's. A driver has no reason to see them.
  if (staff.role !== "owner") redirect("/admin");

  try {
    // Every day the shop has traded, in one read. The window starts at opening
    // rather than the 1st of that month, so the soft run before it is left out.
    const orders = await fetchOrders(SHOP_OPENED, shopYmd(new Date()));
    const periods = buildPeriods(orders);

    return <Revenue periods={periods} comparison={likeForLike(periods)} admin={staff.name} />;
  } catch (e) {
    const message =
      e instanceof CleanCloudError ? e.message : "Something went wrong reading the orders.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-bold text-[#26364d]">Revenue</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
      </main>
    );
  }
}
