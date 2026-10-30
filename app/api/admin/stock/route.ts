import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { addItem, move, removeItem, setCount } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * The shelf, written to.
 *
 * Everybody adds items, brings stock in and writes down what they used. Only
 * an owner overrides a count or takes an item off the list, because those
 * rewrite what everybody else's entries add up to.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const what = typeof body?.what === "string" ? body.what : "";
  const text = (v: unknown, max = 200) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const qty = (v: unknown) => {
    const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    return /^\d{1,9}(\.\d{1,3})?$/.test(s) ? Number(s) : null;
  };
  const owner = staff.role === "owner";

  const done = (res: { ok: true; message: string } | { ok: false; error: string }) =>
    res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });

  if (what === "item") {
    const name = text(body?.name, 120);
    if (!name) return NextResponse.json({ error: "Name the item." }, { status: 400 });
    return done(
      await addItem({
        name,
        unit: text(body?.unit, 30),
        lowAt: body?.lowAt === "" || body?.lowAt == null ? null : qty(body.lowAt),
        quantity: qty(body?.quantity) ?? 0,
        by: staff.name,
      })
    );
  }

  const id = text(body?.id, 60);
  if (!id) return NextResponse.json({ error: "Which item?" }, { status: 400 });

  if (what === "in" || what === "used") {
    const quantity = qty(body?.quantity);
    if (!quantity) return NextResponse.json({ error: "Enter how many." }, { status: 400 });
    return done(await move({ itemId: id, kind: what, quantity, note: text(body?.note), by: staff.name }));
  }

  if (!owner) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  if (what === "count") {
    const counted = qty(body?.quantity);
    if (counted === null) return NextResponse.json({ error: "Enter the count." }, { status: 400 });
    return done(await setCount(id, counted, staff.name));
  }

  if (what === "remove") return done(await removeItem(id, staff.name));

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
