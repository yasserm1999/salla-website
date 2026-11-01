import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { allocate, finish, undo } from "@/lib/pressing";
import { PRESSERS } from "@/lib/press-minutes";

export const dynamic = "force-dynamic";

/**
 * Allocating an order for pressing, and saying it is done.
 *
 * The owners, the manager and the pressers themselves allocate and press
 * done. The pressers share one screen in the shop, so whoever is signed in
 * there must be able to act for either of them — the minutes go to the
 * person the order is allocated to, not to the account that tapped.
 * Only an owner takes a done back.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const what = typeof body?.what === "string" ? body.what : "";
  const text = (v: unknown, max = 2000) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const orderId = text(body?.orderId, 40);
  if (!orderId) return NextResponse.json({ error: "Which order?" }, { status: 400 });

  const me = staff.name.toLowerCase();
  const allowed = staff.role === "owner" || staff.role === "manager" || PRESSERS.includes(me);
  if (!allowed && what !== "undo") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const done = (res: { ok: true; message: string } | { ok: false; error: string }) =>
    res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });

  if (what === "allocate") {
    const to = body?.to === null ? null : typeof body?.to === "string" ? body.to.toLowerCase() : undefined;
    if (to === undefined || (to !== null && !PRESSERS.includes(to))) {
      return NextResponse.json({ error: "Choose who presses it." }, { status: 400 });
    }
    return done(
      await allocate({
        orderId,
        customerId: text(body?.customerId, 40),
        summary: text(body?.summary),
        to,
        by: me,
      })
    );
  }

  if (what === "done") {
    return done(await finish(orderId, me));
  }

  if (what === "undo") {
    if (staff.role !== "owner") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    return done(await undo(orderId));
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
