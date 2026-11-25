import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

/**
 * The office's brain: Claude.
 *
 * It reads the same figures the page shows and answers as whichever worker
 * the question belongs to. Speaking and listening happen in the owner's own
 * browser, so the only outside service is Claude, and its key lives only on
 * the server (ANTHROPIC_API_KEY). Without it the meeting still runs and
 * follows simple spoken commands; it just cannot hold a conversation.
 */

export const hasBrain = () => Boolean(process.env.ANTHROPIC_API_KEY);

export class AiError extends Error {}
// ── Brain ──────────────────────────────────────────────────────────────

let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic());

export const WORKERS = [
  "manager",
  "orders",
  "customer",
  "delivery",
  "billing",
  "supplies",
  "quality",
  "marketing",
  "pressing",
] as const;

const Answer = z.object({
  speaker: z.enum(WORKERS),
  reply: z.string(),
  action: z.enum(["none", "next", "back", "repeat", "details", "pause", "end"]),
  language: z.enum(["en", "ar"]),
});

export type OfficeAnswer = z.infer<typeof Answer>;

const RULES = `You are the staff of Salla, a laundry in Muscat, Oman, in the owner's virtual office. The owner is talking to you out loud, often while driving to work, during the morning meeting. Everything you write is read aloud by a voice.

Who is who (speaker keys):
- manager: Office Manager — runs the meeting, answers general or cross-cutting questions.
- orders: Orders Officer — the wash queue, late orders, what is due.
- customer: Customer Agent — customer messages, feedback, the door bell, orders waiting on the rack.
- delivery: Delivery Scheduler — the van, deliveries, collections, delivery accuracy.
- billing: Billing Clerk — sales, payments, money owed.
- supplies: Supplies Manager — stock and reordering.
- quality: Quality & Complaints — complaints and machine faults.
- marketing: Marketing Officer — regulars who stopped coming.
- pressing: Pressing Supervisor — Basel and Sonu's pressing time.

How to answer:
- Pick the one worker whose corner the question is about, and answer as them, in the first person, as a colleague.
- Use only the shop data given below. If the answer is not in it, say plainly you do not have that, and say where in the dashboard it might be. Never invent numbers, names or orders.
- Be short and spoken: one to three sentences, no lists, no markdown, no symbols like # or →. Say "order 2150", not "#2150". Money is Omani rials.
- Reply in the language the owner used: English, or natural Gulf (Omani) Arabic. Set "language" to match.
- If the owner is telling the meeting what to do — move on, go back, say it again, more detail, wait, finish — set "action" accordingly and keep the reply to a few words (for example "Sure, moving on."). Otherwise action is "none".
- The owner may be driving: never ask them to look at the screen or tap anything unless they ask how to do something.`;

const NARRATE = `Present the agenda point given in the request to the owner, as the worker who owns it, in natural spoken Gulf (Omani) Arabic. Two or three short sentences with the key numbers, warm and conversational. Speaker is that worker, action is "none", language is "ar".`;

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * One exchange with the office.
 *
 * The shop data goes in the system prompt behind a cache mark, so a meeting's
 * follow-up questions reuse it instead of paying for it again each time.
 */
export async function ask(input: {
  question: string;
  history: Turn[];
  data: string;
  today: string;
  point: string | null;
  narrate: boolean;
}): Promise<OfficeAnswer> {
  if (!hasBrain()) throw new AiError("ANTHROPIC_API_KEY is not set.");

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...input.history.slice(-12).map((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content:
        (input.point ? `[The meeting is on: ${input.point}]\n` : "") +
        (input.narrate ? `${NARRATE}\n\n` : "") +
        input.question,
    },
  ];
  // The API wants a user turn first; drop any leading assistant lines.
  while (messages.length && messages[0].role !== "user") messages.shift();

  const response = await claude().beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    // If Claude declines, the API retries on a fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Spoken back to someone waiting at a red light: quick beats thorough.
    output_config: { effort: "low", format: betaZodOutputFormat(Answer) },
    system: [
      { type: "text", text: RULES },
      {
        type: "text",
        text: `Today in the shop is ${input.today}. The shop data, read just now:\n${input.data}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  if (response.stop_reason === "refusal") {
    return { speaker: "manager", reply: "Sorry, I can't help with that one.", action: "none", language: "en" };
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new AiError("The answer could not be read.");
  return parsed;
}
