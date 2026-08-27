import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin-session";
import { fetchCustomers } from "@/lib/cleancloud";

export const dynamic = "force-dynamic";

/**
 * Names and numbers, asked for a list at a time.
 *
 * CleanCloud rate-limits customer lookups, so fetching them while the page
 * renders made every load wait ten seconds for names most of which nobody was
 * going to read. The board now draws immediately and each list asks for its
 * own names when somebody opens it.
 */
export async function POST(req: Request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 40)
    : [];

  if (ids.length === 0) return NextResponse.json({ people: {} });

  const found = await fetchCustomers(ids);
  return NextResponse.json({
    people: Object.fromEntries(
      [...found.entries()].map(([id, b]) => [id, { name: b.name, tel: b.tel, place: b.place }])
    ),
  });
}
