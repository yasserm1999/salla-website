import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { correctCheck, recordCheck } from "@/lib/quality";

export const dynamic = "force-dynamic";

/**
 * Signing an order off, and putting a wrong one right.
 *
 * Anyone at the dashboard may check an order — the PIN says who did it, not
 * the login. Only an owner may change a check once it is made.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  if (body?.what === "check") {
    const orderId = text(body.orderId, 20);
    if (!orderId || !/^\d+$/.test(orderId)) {
      return NextResponse.json({ error: "Which order?" }, { status: 400 });
    }
    const takenOn = text(body.takenOn, 10);
    const res = await recordCheck({
      orderId,
      takenOn: takenOn && /^\d{4}-\d{2}-\d{2}$/.test(takenOn) ? takenOn : null,
      customerId: text(body.customerId, 20),
      customerName: text(body.customerName, 120),
      pin: typeof body.pin === "string" ? body.pin : "",
      deviceUser: staff.name,
    });
    return res.ok
      ? NextResponse.json({ success: true, mark: res.mark })
      : NextResponse.json({ error: res.error }, { status: res.status });
  }

  if (body?.what === "correct") {
    if (staff.role !== "owner") return NextResponse.json({ error: "Only an owner can change a check." }, { status: 403 });
    const checkId = text(body.checkId, 60);
    const action = body.action === "remove" ? "remove" : body.action === "reassign" ? "reassign" : null;
    if (!checkId || !action) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const res = await correctCheck({
      checkId,
      action,
      toStaff: text(body.toStaff, 40),
      reason: text(body.reason, 300),
      by: staff.name,
    });
    return res.ok
      ? NextResponse.json({ success: true, mark: res.mark })
      : NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
