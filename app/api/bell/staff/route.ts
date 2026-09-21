import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { acknowledge, isBellStaff, waitingRings } from "@/lib/bell";
import { forgetSubscription, saveSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * The screen inside the shop.
 *
 * Everything here needs a session, because everything here is somebody else's
 * name, telephone number and rack.
 */
async function whoever() {
  const staff = await currentStaff();
  if (!staff) return null;
  return isBellStaff(staff.name, staff.role) ? staff : null;
}

export async function GET() {
  const staff = await whoever();
  if (!staff) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json({ rings: await waitingRings(), me: staff.name });
}

export async function POST(req: Request) {
  const staff = await whoever();
  if (!staff) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const what = typeof body?.what === "string" ? body.what : "";

  if (what === "coming") {
    const id = typeof body?.id === "string" ? body.id : "";
    const done = await acknowledge(id, staff.name);
    return done
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Already answered." }, { status: 409 });
  }

  if (what === "subscribe") {
    const sub = body?.subscription;
    const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
    const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
    const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Bad subscription." }, { status: 400 });
    }
    await saveSubscription({
      staff: staff.name,
      endpoint,
      p256dh,
      auth,
      label: typeof body?.label === "string" ? body.label.slice(0, 120) : null,
    });
    return NextResponse.json({ success: true });
  }

  if (what === "unsubscribe") {
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
    if (endpoint) await forgetSubscription(endpoint);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
