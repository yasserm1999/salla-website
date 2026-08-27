import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { closeCase, reopenCase } from "@/lib/investigations";

export const dynamic = "force-dynamic";

/**
 * Marking a lapsed customer as looked into, and undoing it.
 *
 * Owners only. A driver has no business in the customer book, and the page
 * that offers these buttons is never rendered for one.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId) return NextResponse.json({ error: "No customer given." }, { status: 400 });

  // The client sends the order the case is being closed against, so a customer
  // who returns and lapses again comes back as a new case rather than staying
  // filed away for good.
  const lastOrderAt =
    typeof body?.lastOrderAt === "string" && !Number.isNaN(Date.parse(body.lastOrderAt))
      ? new Date(body.lastOrderAt)
      : null;

  const result = await closeCase(customerId, lastOrderAt, staff.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ success: true, by: staff.name, at: new Date().toISOString() });
}

export async function DELETE(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId) return NextResponse.json({ error: "No customer given." }, { status: 400 });

  const result = await reopenCase(customerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ success: true });
}
