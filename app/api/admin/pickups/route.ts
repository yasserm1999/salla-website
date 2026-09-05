import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import {
  addJob,
  addPerson,
  addRoutine,
  setJobStatus,
  stopRoutine,
  type JobKind,
  type JobStatus,
} from "@/lib/pickups";

export const dynamic = "force-dynamic";

const KINDS: JobKind[] = ["pickup", "delivery"];
const STATUSES: JobStatus[] = ["waiting", "out", "done", "missed"];

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
    const kind = KINDS.includes(body?.kind) ? (body.kind as JobKind) : null;
    const onDate = day(body?.onDate);
    if (!personId || !kind || !onDate) {
      return NextResponse.json({ error: "Choose a customer, a kind and a day." }, { status: 400 });
    }
    const res = await addJob({ personId, kind, onDate, atTime: clock(body?.atTime), note: text(body?.note) });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "routine") {
    if (staff.role !== "owner") {
      return NextResponse.json({ error: "Only the shop sets up a repeat." }, { status: 403 });
    }
    const personId = text(body?.personId, 60);
    const kind = KINDS.includes(body?.kind) ? (body.kind as JobKind) : null;
    const everyDays = Number(body?.everyDays);
    const startsOn = day(body?.startsOn);
    if (!personId || !kind || !startsOn || !Number.isInteger(everyDays) || everyDays < 1 || everyDays > 180) {
      return NextResponse.json(
        { error: "Choose a customer, a kind, a start day and an interval of 1 to 180 days." },
        { status: 400 }
      );
    }
    const res = await addRoutine({
      personId,
      kind,
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
    const res = await stopRoutine(id);
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "status") {
    const id = text(body?.id, 60);
    const status = STATUSES.includes(body?.status) ? (body.status as JobStatus) : null;
    if (!id || !status) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const res = await setJobStatus({ id, status, reason: text(body?.reason), by: staff.name });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
