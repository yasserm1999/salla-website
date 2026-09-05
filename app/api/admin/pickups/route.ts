import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import {
  addJob,
  addPerson,
  addRoutine,
  setJobStatus,
  stopRoutine,
  syncCustomers,
  type JobStatus,
} from "@/lib/pickups";
import { fetchOrders, defaultWindow } from "@/lib/cleancloud";

export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["waiting", "out", "done", "missed", "cancelled"];

/**
 * The round, written to.
 *
 * The driver marks his own progress and adds the customer who rang while he
 * was out; only an owner sets up a standing arrangement, since that decides
 * what the shop does every week rather than what it does this afternoon.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role === "washer") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const what = typeof body?.what === "string" ? body.what : "";
  const text = (v: unknown, max = 200) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const day = (v: unknown) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const clock = (v: unknown) =>
    typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null;

  if (what === "person") {
    const name = text(body?.name, 120);
    if (!name) return NextResponse.json({ error: "A name is needed." }, { status: 400 });
    const res = await addPerson({
      name,
      phone: text(body?.phone, 40),
      address: text(body?.address, 300),
      note: text(body?.note),
    });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message, id: res.id })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "job") {
    const personId = text(body?.personId, 60);
    const onDate = day(body?.onDate);
    if (!personId || !onDate) {
      return NextResponse.json({ error: "Choose a customer and a day." }, { status: 400 });
    }
    // Always a collection: deliveries are CleanCloud's and stay there.
    const res = await addJob({ personId, kind: "pickup", onDate, atTime: clock(body?.atTime), note: text(body?.note) });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "routine") {
    if (staff.role !== "owner") {
      return NextResponse.json({ error: "Only the shop sets up a repeat." }, { status: 403 });
    }
    const personId = text(body?.personId, 60);
    const everyDays = Number(body?.everyDays);
    const startsOn = day(body?.startsOn);
    if (!personId || !startsOn || !Number.isInteger(everyDays) || everyDays < 1 || everyDays > 180) {
      return NextResponse.json(
        { error: "Choose a customer, a start day and an interval of 1 to 180 days." },
        { status: 400 }
      );
    }
    const res = await addRoutine({
      personId,
      kind: "pickup",
      everyDays,
      atTime: clock(body?.atTime),
      startsOn,
      note: text(body?.note),
      by: staff.name,
    });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "stopRoutine") {
    if (staff.role !== "owner") {
      return NextResponse.json({ error: "Only the shop stops a repeat." }, { status: 403 });
    }
    const id = text(body?.id, 60);
    if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

    // Same rule as a cancelled pickup, and for the same reason.
    const why = text(body?.reason);
    if (!why) {
      return NextResponse.json({ error: "Stopping a repeat needs a reason." }, { status: 400 });
    }

    const res = await stopRoutine(id, why, staff.name);
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "status") {
    const id = text(body?.id, 60);
    const status = STATUSES.includes(body?.status) ? (body.status as JobStatus) : null;
    if (!id || !status) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

    const reason = text(body?.reason);
    /*
      Checked here and not only in the browser. A cancellation with no reason
      is the one record nobody can reconstruct afterwards — the pickup simply
      leaves the day and there is nothing left to ask anyone about.
    */
    if (status === "cancelled" && !reason) {
      return NextResponse.json({ error: "A cancellation needs a reason." }, { status: 400 });
    }

    const res = await setJobStatus({ id, status, reason, by: staff.name });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "syncCustomers") {
    /*
      Reads every customer who has had an order and copies them into the book.
      Slow the first time and nearly free afterwards, so it is a button rather
      than something a page load waits for.
    */
    const { from, to } = defaultWindow();
    const orders = await fetchOrders(from, to);
    const res = await syncCustomers(orders.map((o) => o.customerID));
    return res.ok
      ? NextResponse.json({
          success: true,
          message:
            res.added || res.updated
              ? `${res.added} added, ${res.updated} updated.`
              : "Already up to date.",
        })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
