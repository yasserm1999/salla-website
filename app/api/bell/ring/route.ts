import { NextResponse } from "next/server";
import { bellStaff, ring, ringStatus } from "@/lib/bell";
import { buzz } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * The car park's only two requests: ring it, and has anyone come yet.
 *
 * Nothing about the customer comes back either way. Whoever is holding the
 * phone outside may not be the person whose name is on the order, so the
 * answer is deliberately as dull as a doorbell: it is ringing, or somebody is
 * on their way.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const deviceId =
    typeof body?.deviceId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.deviceId)
      ? body.deviceId
      : null;
  if (!deviceId) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const asked =
    typeof body?.asked === "string" && body.asked.trim() ? body.asked.trim().slice(0, 40) : null;
  const lang = body?.lang === "ar" ? "ar" : "en";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const result = await ring({ deviceId, ip, asked, lang });

  if (!result.ok) {
    if (result.tooSoon) {
      return NextResponse.json({ alreadyRinging: true, id: result.ringId }, { status: 429 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  /*
    The notification says where to walk, not merely that somebody is there —
    a rack number read off a locked phone can save the walk back. It reuses
    what the ring already worked out, so it costs no second lookup and cannot
    disagree with the screen indoors.

    Buzzing is a courtesy on top of that screen, so a failure here is not the
    customer's problem: the ring is recorded either way.
  */
  const { found } = result;
  let line = "Someone is waiting outside.";
  if (asked) {
    const racks = [...new Set(found.orders.filter((o) => o.ready).map((o) => o.rack ?? "?"))];
    line = found.name ?? `"${asked}"`;
    line += racks.length
      ? ` — ready on rack ${racks.join(", ")}`
      : found.customerId
        ? " — nothing ready"
        : " — not recognised";
  }

  await buzz(bellStaff(), {
    title: "🔔 Customer at the door",
    body: line,
    ringId: result.id,
  });

  return NextResponse.json({ id: result.id, status: "ringing" });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return NextResponse.json({ status: await ringStatus(id) });
}
