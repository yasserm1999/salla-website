import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import {
  fetchOrders,
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
import {
  loadEvents,
  progressByOrder,
  runStatus,
  deliveryConcerns,
  type StopState,
} from "@/lib/delivery";
import { loadDay } from "@/lib/pickups";
import { loadSeen } from "@/lib/reviews";
import { Board } from "./Board";
import { Driver } from "./Driver";
import { Work } from "./Work";

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
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");

  const { from, to } = defaultWindow();
  const today = shopYmd(new Date());

  try {
    const orders = await fetchOrders(from, to);
    const runs = buildRuns(orders);
    const events = await loadEvents(today);
    const progress = progressByOrder(events.events);

    /*
      A driver's page stops here. The rest of this function reads takings and
      builds the debt list, and none of that should travel to a phone in a van
      — so it is not merely hidden from them, it is never fetched.
    */
    if (staff.role === "driver") {
      const states: Record<string, StopState> = {};
      for (const [id, p] of progress) states[id] = p.state;

      const forDriver = await loadDay(today);

      return (
        <Driver
          runs={runs}
          driver={staff.name}
          today={today}
          states={states}
          pickups={forDriver.data.jobs
            .filter((j) => j.kind === "pickup" && j.status !== "cancelled")
            .map((j) => ({
              id: j.id,
              name: j.person.name,
              phone: j.person.phone,
              address: j.person.address,
              atTime: j.atTime,
              status: j.status,
              note: j.note,
            }))}
          storeReady={events.ready}
          storeProblem={events.ready ? null : events.reason}
        />
      );
    }

    const board = buildBoard(orders);

    /*
      A washer's page stops here too, and for the same reason: what follows
      reads the takings and builds the debt list, and none of that is his to
      see. He gets the same orders in the same order of urgency, with every
      figure of money absent rather than hidden.
    */
    if (staff.role === "washer") {
      return <Work board={{ ...board, windowFrom: from, windowTo: to }} worker={staff.name} />;
    }

    const debts = buildDebts(orders);

    /*
      Today's collections, planned alongside the deliveries.

      The van goes out once. A schedule showing only half of what it has to
      do is a schedule somebody has to hold the other half of in their head.
    */
    const pickupBoard = await loadDay(today);

    /*
      Orders nobody has read yet. Only the last few days count as news — an
      order from a fortnight ago is history whether it was ticked or not.
    */
    const seen = await loadSeen();
    const newsSince = shopYmd(new Date(Date.now() - 3 * 86_400_000));
    const unread = orders
      .filter((o) => o.createdAt && shopYmd(o.createdAt) >= newsSince)
      .filter((o) => !seen.seen.has(o.id))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 60)
      .map((o) => ({
        id: o.id,
        customerID: o.customerID,
        total: o.total,
        pieces: o.pieces,
        summary: o.summary,
        at: o.createdAt ? o.createdAt.toISOString() : null,
      }));

    // Money is read from payments, so the two ranges are asked for separately.
    const [revenueToday, revenueMonth] = await Promise.all([
      fetchTakings(today, today),
      fetchTakings(monthStart(), today),
    ]);
    const summary = buildSummary(orders, board, runs, revenueToday, revenueMonth);

    /*
      Names are not fetched here. CleanCloud rate-limits that endpoint, and
      waiting for forty of them made every load take ten seconds for names
      most of which nobody opens. The board draws now; each list asks for its
      own names when somebody expands it.
    */

    const delivery = {
      status: runStatus(runs, events.events),
      concerns: deliveryConcerns(runs, events.events),
      states: Object.fromEntries(progress),
      ready: events.ready,
      problem: events.ready ? null : events.reason,
    };

    return (
      <Board
        board={{ ...board, windowFrom: from, windowTo: to }}
        runs={runs}
        debts={debts}
        summary={summary}
        admin={staff.name}
        delivery={delivery}
        today={today}
        unread={unread}
        reviewsReady={seen.ready}
        pickups={pickupBoard.data.jobs
          .filter((j) => j.kind === "pickup" && j.status !== "cancelled")
          .map((j) => ({
            id: j.id,
            name: j.person.name,
            phone: j.person.phone,
            address: j.person.address,
            atTime: j.atTime,
            status: j.status,
            everyDays: j.everyDays,
            note: j.note,
          }))}
      />
    );
  } catch (e) {
    const message =
      e instanceof CleanCloudError ? e.message : "Something went wrong reading the orders.";
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-bold text-[#26364d]">Shop dashboard</h1>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {message}
        </p>
        <p className="mt-3 text-sm text-[#8a9099]">
          The orders live in CleanCloud, so this page is only as available as they are. Nothing is
          stored here — reload once it answers again.
        </p>
      </main>
    );
  }
}
