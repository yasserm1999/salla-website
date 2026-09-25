import { NextResponse } from "next/server";
import { askFor, findCustomer, myOrders, openRequests, setPassword, signIn } from "@/lib/account";
import { currentCustomerId, endCustomer, startCustomer } from "@/lib/customer-session";
import { shiftDay, shopToday } from "@/lib/pickups";

export const dynamic = "force-dynamic";

/**
 * Everything a customer can do for themselves.
 *
 * Nothing here reads a customer number from the request except at sign-in:
 * afterwards it comes from the signed cookie, so asking about somebody else's
 * washing is not a matter of changing a number in the address bar.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const what = typeof body?.what === "string" ? body.what : "";

  if (what === "login") {
    const who = typeof body?.who === "string" ? body.who.slice(0, 40) : "";
    const password = typeof body?.password === "string" ? body.password.slice(0, 100) : "";
    if (!who || !password) {
      return NextResponse.json({ error: "Enter your number and password." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await signIn(who, password, ip);

    if (!result.ok) {
      const message =
        result.error === "tooMany"
          ? "Too many tries. Please wait fifteen minutes, or call the shop."
          : "That number and password do not match. Ask the shop if you are unsure.";
      return NextResponse.json({ error: message }, { status: result.error === "tooMany" ? 429 : 401 });
    }

    await startCustomer(result.customer.id);
    return NextResponse.json({ success: true });
  }

  if (what === "logout") {
    await endCustomer();
    return NextResponse.json({ success: true });
  }

  /* ── Everything past here is for whoever is signed in ───────────── */

  const id = await currentCustomerId();
  if (!id) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  if (what === "mine") {
    const [customer, orders, waiting] = await Promise.all([
      findCustomer(id),
      myOrders(id),
      openRequests(id),
    ]);
    return NextResponse.json({
      customer: customer
        ? { id: customer.id, name: customer.name, tel: customer.tel, place: customer.place }
        : null,
      orders,
      waiting,
      today: shopToday(),
      until: shiftDay(shopToday(), 14),
    });
  }

  if (what === "ask") {
    const customer = await findCustomer(id);
    if (!customer) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const kind = body?.kind === "delivery" ? "delivery" : "pickup";
    const onDate =
      typeof body?.onDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.onDate)
        ? body.onDate
        : shopToday();
    const atTime =
      typeof body?.atTime === "string" && /^\d{2}:\d{2}$/.test(body.atTime) ? body.atTime : null;
    const note =
      typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;

    const asked = await askFor({ customer, kind, onDate, atTime, note });
    return asked.ok
      ? NextResponse.json({ success: true, message: asked.message })
      : NextResponse.json({ error: asked.error }, { status: 400 });
  }

  if (what === "password") {
    const password = typeof body?.password === "string" ? body.password : "";
    if (password.length < 6) {
      return NextResponse.json({ error: "Use at least six characters." }, { status: 400 });
    }
    const done = await setPassword(id, password);
    return done
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "That did not save." }, { status: 500 });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
