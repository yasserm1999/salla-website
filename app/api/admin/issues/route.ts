import { NextResponse } from "next/server";
import { currentStaff } from "@/lib/admin-session";
import { raiseIssue, addNote, assign, setStatus, KINDS, type IssueKind, type IssueStatus } from "@/lib/issues";

export const dynamic = "force-dynamic";

/** The two people who can act on what is raised. */
const OWNERS = ["yasser", "osama"];

const STATUSES: IssueStatus[] = ["open", "doing", "done"];

/**
 * Raising an issue, and dealing with it.
 *
 * Anybody who works here may raise one — that is the whole point, and a report
 * that needs permission is a report that does not get made. Only the owners
 * assign, comment and close, because those decide what the shop does next.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const what = typeof body?.what === "string" ? body.what : "";
  const text = (v: unknown, max = 2000) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  if (what === "raise") {
    const kind = KINDS.includes(body?.kind) ? (body.kind as IssueKind) : null;
    const description = text(body?.description);
    if (!kind || !description) {
      return NextResponse.json({ error: "Choose a type and describe it." }, { status: 400 });
    }

    /*
      Checked here as a shape, not trusted as a number: a figure that reaches
      the ledger through a form has to be something Postgres will accept as
      money, or it lands as null and the expense reads as free.
    */
    const amount =
      kind === "expense" && typeof body?.amount === "string" && /^\d{1,9}(\.\d{1,3})?$/.test(body.amount.trim())
        ? body.amount.trim()
        : null;
    if (kind === "expense" && !amount) {
      return NextResponse.json({ error: "Enter the amount, up to three decimals." }, { status: 400 });
    }

    const res = await raiseIssue({
      kind,
      description,
      amount,
      customerId: text(body?.customerId, 40),
      customerName: text(body?.customerName, 120),
      photo: typeof body?.photo === "string" ? body.photo : null,
      by: staff.name,
    });
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  // Everything below decides what the shop does next, so it is the owners'.
  if (staff.role !== "owner") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const id = text(body?.id, 60);
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  if (what === "note") {
    const note = text(body?.body);
    if (!note) return NextResponse.json({ error: "Write something first." }, { status: 400 });
    const res = await addNote(id, note, staff.name);
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "assign") {
    const to = Array.isArray(body?.to)
      ? body.to.filter((x: unknown): x is string => typeof x === "string" && OWNERS.includes(x))
      : [];
    const res = await assign(id, to, staff.name);
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  if (what === "status") {
    const status = STATUSES.includes(body?.status) ? (body.status as IssueStatus) : null;
    if (!status) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const res = await setStatus(id, status, staff.name);
    return res.ok
      ? NextResponse.json({ success: true, message: res.message })
      : NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}
