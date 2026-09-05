import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { loadDay, loadRoutines, shopToday } from "@/lib/pickups";
import { Pickups } from "./Pickups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — pickups" };

/**
 * The collections the shop schedules for itself.
 *
 * Pickups only. Deliveries are orders in CleanCloud with promised windows
 * already on them, and they have a page of their own — showing them here as
 * well only invited the question of which screen was the real one.
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

  const [board, routines] = await Promise.all([loadDay(day), loadRoutines(today)]);

  return (
    <Pickups
      day={day}
      today={today}
      jobs={board.data.jobs.filter((j) => j.kind === "pickup")}
      people={board.data.people}
      routines={routines.data.filter((r) => r.kind === "pickup")}
      staff={staff.name}
      role={staff.role === "owner" ? "owner" : "driver"}
      ready={board.ready}
      problem={board.ready ? null : board.reason}
    />
  );
}
