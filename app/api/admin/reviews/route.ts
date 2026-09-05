import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { markSeen } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/** Marking new orders as read. The owner's business, not the staff's. */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const res = await markSeen(ids, staff.name);
  return res.ok
    ? NextResponse.json({ success: true, marked: res.marked })
    : NextResponse.json({ error: res.error }, { status: 500 });
}
