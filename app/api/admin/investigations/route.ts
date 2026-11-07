import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { closeCase, reopenCase, OUTCOMES, type Outcome } from "@/lib/investigations";

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

  /*
    What they said when we rang: satisfied, or an issue with its reason.
    "Other" is the reason that has to be written in their own words.
  */
  const outcome = OUTCOMES.includes(body?.outcome) ? (body.outcome as Outcome) : null;
  if (!outcome) {
    return NextResponse.json({ error: "Choose satisfied or the reason for the issue." }, { status: 400 });
  }
  const typed =
    typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
  if (outcome === "other" && !typed) {
    return NextResponse.json({ error: "Write what the other reason was." }, { status: 400 });
  }
  const note = outcome === "other" ? typed : null;

  const result = await closeCase(customerId, lastOrderAt, staff.name, outcome, note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({
    success: true,
    by: staff.name,
    at: new Date().toISOString(),
    outcome,
    note,
  });
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
