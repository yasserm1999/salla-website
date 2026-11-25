import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { currentStaff } from "@/lib/admin-session";
import { shopYmd } from "@/lib/cleancloud";
import { AiError, ask, type Turn } from "@/lib/office-ai";

export const dynamic = "force-dynamic";

/**
 * A question to the office, answered by the right worker.
 *
 * The page sends the figures it already shows rather than this route reading
 * CleanCloud again: the meeting is a conversation, and a CleanCloud read per
 * question would make every answer wait seconds for the same numbers.
 */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") return NextResponse.json({ error: "Owners only." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";
  const data = typeof body?.data === "string" ? body.data.slice(0, 300_000) : "";
  const point = typeof body?.point === "string" ? body.point.slice(0, 200) : null;
  const narrate = body?.narrate === true;
  const history: Turn[] = Array.isArray(body?.history)
    ? body.history
        .filter(
          (t: unknown): t is Turn =>
            !!t &&
            typeof t === "object" &&
            ((t as Turn).role === "user" || (t as Turn).role === "assistant") &&
            typeof (t as Turn).content === "string"
        )
        .map((t: Turn) => ({ role: t.role, content: t.content.slice(0, 2000) }))
    : [];
  if (!question || !data) return NextResponse.json({ error: "Nothing was asked." }, { status: 400 });

  try {
    return NextResponse.json(
      await ask({ question, history, data, point, narrate, today: shopYmd(new Date()) })
    );
  } catch (e) {
    let message = "The office could not answer just now.";
    if (e instanceof AiError) message = e.message;
    else if (e instanceof Anthropic.RateLimitError) message = "The office is busy — ask again in a moment.";
    else if (e instanceof Anthropic.AuthenticationError) message = "The Claude key was refused. Check ANTHROPIC_API_KEY.";
    else if (e instanceof Anthropic.APIError) message = `Claude said ${e.status}.`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
