import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { hasBrain } from "@/lib/office-ai";

export const dynamic = "force-dynamic";

/** Whether Claude is switched on — never the key itself. */
export async function GET() {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") return NextResponse.json({ error: "Owners only." }, { status: 403 });
  return NextResponse.json({ brain: hasBrain() });
}
