import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { saveEvents, type EventKind, type IncomingEvent } from "@/lib/delivery";
import { shopYmd } from "@/lib/cleancloud";

export const dynamic = "force-dynamic";

const KINDS: EventKind[] = ["on_the_way", "delivered", "failed"];

/**
 * The driver saying what he has done.
 *
 * Takes a batch rather than one event, because a phone that has been out of
 * signal sends everything at once the moment it comes back. Both staff roles
 * may post: the driver marks his own round, and the owner can mark a stop from
 * the shop when the driver rings in rather than taps.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (staff.role === "washer") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.events) ? body.events : [];
  const today = shopYmd(new Date());

  const events: IncomingEvent[] = [];
  for (const e of raw.slice(0, 200)) {
    const kind = typeof e?.kind === "string" ? (e.kind as EventKind) : null;
    if (!kind || !KINDS.includes(kind)) continue;
    // Every event is about one parcel; there is nothing else to record.
    const orderId = typeof e?.orderId === "string" && e.orderId ? e.orderId : null;
    if (!orderId) continue;

    events.push({
      orderId,
      kind,
      reason: typeof e?.reason === "string" && e.reason.trim() ? e.reason.trim().slice(0, 200) : null,
      at: typeof e?.at === "string" ? e.at : new Date().toISOString(),
      day: typeof e?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.day) ? e.day : today,
    });
  }

  if (events.length === 0) {
    return NextResponse.json({ error: "Nothing usable to record." }, { status: 400 });
  }

  const result = await saveEvents(events, staff.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ success: true, saved: result.saved });
}
