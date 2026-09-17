import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { loadRoutines, loadSpan, shiftDay, shopToday } from "@/lib/pickups";
import { Pickups } from "./Pickups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — pickups" };

/**
 * The collections the shop schedules for itself.
 *
 * Pickups only. Deliveries are orders in CleanCloud with promised windows
 * already on them, and they have a page of their own — showing them here as
 * well only invited the question of which screen was the real one.
 *
 * The manager arranges them alongside the owners: booking a standing
 * collection is running the shop, not keeping its books.
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

  /*
    A fortnight, not a day.

    A pickup booked for tomorrow used to be saved and then shown nowhere: this
    page listed the day being looked at, and the dashboard listed today. The
    span covers what is booked ahead so a booking can always be seen straight
    after it is made.
  */
  const anchor = day > today ? day : today;
  const [board, routines] = await Promise.all([
    loadSpan(day < today ? day : today, shiftDay(anchor, 13), anchor),
    loadRoutines(today),
  ]);

  const pickups = board.data.jobs.filter((j) => j.kind === "pickup");

  return (
    <Pickups
      day={day}
      today={today}
      jobs={pickups.filter((j) => j.onDate === day)}
      ahead={pickups.filter(
        (j) => j.onDate > day && (j.status === "waiting" || j.status === "out")
      )}
      people={board.data.people}
      routines={routines.data.filter((r) => r.kind === "pickup")}
      staff={staff.name}
      role={staff.role === "owner" || staff.role === "manager" ? "owner" : "driver"}
      ready={board.ready}
      problem={board.ready ? null : board.reason}
    />
  );
}
