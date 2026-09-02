import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { markReviewed } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/** Marking new orders as read. The owner's business, not the driver's. */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((x: unknown): x is string => typeof x === "string").slice(0, 200)
    : [];

  const result = await markReviewed(ids, staff.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ success: true, marked: result.marked });
}
