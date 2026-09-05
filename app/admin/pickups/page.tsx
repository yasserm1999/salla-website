import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { loadDay, loadRoutines, shopToday } from "@/lib/pickups";
import { Round } from "./Round";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — the round" };

/**
 * The day's collections and returns.
 *
 * One day wide on purpose. The question this page answers is "what is left
 * before I go home", and a list that carries last week's errands cannot answer
 * it. Yesterday is a click away for anyone who needs to check.
 */
export default async function PickupsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  // The washer's work is in the shop; the round is not his.
  if (staff.role === "washer") redirect("/admin");

  const today = shopToday();
  const asked = (await searchParams).day;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;

  const [board, routines] = await Promise.all([loadDay(day), loadRoutines(today)]);

  return (
    <Round
      day={day}
      today={today}
      jobs={board.data.jobs}
      people={board.data.people}
      routines={routines.data}
      staff={staff.name}
      role={staff.role === "owner" ? "owner" : "driver"}
      ready={board.ready}
      problem={board.ready ? null : board.reason}
    />
  );
}
