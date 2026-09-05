import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { fetchOrders, buildRuns, defaultWindow, dueMinutes } from "@/lib/cleancloud";
import { loadDay, loadRoutines, shopToday } from "@/lib/pickups";
import { Pickups, type DeliveryStop } from "./Pickups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — pickups" };

/**
 * The collections the shop schedules, and the deliveries it already owes.
 *
 * Only the collections are stored here. A delivery is an order in CleanCloud
 * with a promised window already on it, and scheduling one here too would
 * leave two systems each half-believing they own the same errand — so today's
 * are read across and shown beside the pickups, in one list down the clock,
 * without being copied.
 */
export default async function PickupsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (staff.role === "washer") redirect("/admin");

  const today = shopToday();
  const asked = (await searchParams).day;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;

  const { from, to } = defaultWindow();
  const [board, routines, orders] = await Promise.all([
    loadDay(day),
    loadRoutines(today),
    fetchOrders(from, to),
  ]);

  /*
    Deliveries are only shown for the day being looked at, and only from the
    runs CleanCloud already knows about. Nothing here writes back to them.
  */
  const deliveries: DeliveryStop[] = buildRuns(orders)
    .filter((r) => r.day === day)
    .flatMap((r) =>
      r.stops.map((o) => ({
        id: o.id,
        customerID: o.customerID,
        window: o.dueTimeLabel,
        minutes: dueMinutes(o.dueTimeLabel),
        cleaned: o.cleaned,
        rack: o.rack,
        pieces: o.pieces,
        total: o.total,
        paid: o.paid,
      }))
    );

  return (
    <Pickups
      day={day}
      today={today}
      jobs={board.data.jobs.filter((j) => j.kind === "pickup")}
      deliveries={deliveries}
      people={board.data.people}
      routines={routines.data.filter((r) => r.kind === "pickup")}
      staff={staff.name}
      role={staff.role === "owner" ? "owner" : "driver"}
      ready={board.ready}
      problem={board.ready ? null : board.reason}
    />
  );
}
