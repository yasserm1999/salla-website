import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Returns the stored feedback, for the inbox page.
 *
 * Guarded by a shared password because the responses contain customer names
 * and phone numbers. The password is checked against an environment variable
 * and compared in constant time so the endpoint cannot be probed a character
 * at a time.
 */

export const dynamic = "force-dynamic";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request) {
  try {
    const expected = process.env.FEEDBACK_ADMIN_PASSWORD;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!expected || !url || !key) {
      return NextResponse.json(
        { success: false, message: "The feedback inbox is not configured yet." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";

    if (!constantTimeEqual(password, expected)) {
      return NextResponse.json(
        { success: false, message: "Wrong password." },
        { status: 401 }
      );
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("salla_feedback")
      .select("id, created_at, rating_quality, rating_service, recommend, remarks, name, phone, language")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("feedback list failed:", error.message);
      return NextResponse.json(
        { success: false, message: "Could not load the feedback." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, entries: data ?? [] });
  } catch (error) {
    console.error("feedback list error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 }
    );
  }
}
