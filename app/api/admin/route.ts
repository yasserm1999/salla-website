import { NextResponse } from "next/server";
import { checkCredentials, startSession, endSession, isConfigured } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/**
 * Signing in and out of the shop dashboard.
 *
 * A wrong username and a wrong password give the same answer, so the form
 * cannot be used to find out which names exist.
 */
export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { success: false, message: "The dashboard has no login set up yet." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkCredentials(username, password)) {
    return NextResponse.json(
      { success: false, message: "That username and password do not match." },
      { status: 401 }
    );
  }

  await startSession(username);
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ success: true });
}
