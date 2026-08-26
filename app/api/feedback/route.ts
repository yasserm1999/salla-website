import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Receives a customer feedback submission and stores it.
 *
 * The form is public, so everything here is treated as untrusted: fields are
 * length-capped, the rating is range-checked, and the recommend answer must be
 * one of three known values. Writing goes through the service-role key on the
 * server — the browser never touches the database.
 */

const RECOMMEND = ["yes", "maybe", "no"] as const;

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error("feedback: Supabase is not configured");
      return NextResponse.json(
        { success: false, message: "Feedback is not set up yet." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: "Could not read the submission." },
        { status: 400 }
      );
    }

    // Both ratings are required; everything else is optional.
    const ratingQuality = Number(body.ratingQuality);
    const ratingService = Number(body.ratingService);
    const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

    if (!valid(ratingQuality) || !valid(ratingService)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please rate both cleaning quality and customer service, from 1 to 5.",
        },
        { status: 400 }
      );
    }

    const recommendRaw = typeof body.recommend === "string" ? body.recommend.toLowerCase() : null;
    const recommend =
      recommendRaw && (RECOMMEND as readonly string[]).includes(recommendRaw)
        ? recommendRaw
        : null;

    const language = body.language === "ar" ? "ar" : "en";

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { error } = await supabase.from("salla_feedback").insert({
      rating_quality: ratingQuality,
      rating_service: ratingService,
      recommend,
      remarks: clean(body.remarks, 2000),
      name: clean(body.name, 120),
      phone: clean(body.phone, 40),
      language,
      user_agent: clean(req.headers.get("user-agent"), 300),
    });

    if (error) {
      console.error("feedback insert failed:", error.message);
      return NextResponse.json(
        { success: false, message: "Could not save your feedback. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("feedback route error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
