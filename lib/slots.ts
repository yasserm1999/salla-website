/**
 * The hours the van can be asked for.
 *
 * Nine of them, in the shape of the shop's day: two late in the morning, then
 * the long evening run when people are home. A customer picks one rather than
 * typing a time, so nobody asks for half past six in the morning and nobody in
 * the shop has to ring back to say no.
 *
 * Client-safe: the page and the server both read this list, so what is offered
 * and what is accepted can never drift apart.
 */

export const SLOT_CAPACITY = 3;

/** Each slot is one hour, named by the hour it starts. */
export const SLOTS = [
  "10:00",
  "11:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
] as const;

export type Slot = (typeof SLOTS)[number];

export const isSlot = (value: string): value is Slot =>
  (SLOTS as readonly string[]).includes(value);

const hour12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);

/** "10 – 11 am", "٧ – ٨ مساءً" — the way somebody would say it aloud. */
export function slotLabel(start: string, lang: "en" | "ar" = "en"): string {
  const h = Number(start.slice(0, 2));
  const from = hour12(h);
  const to = hour12(h + 1);

  if (lang === "ar") {
    const part = h < 12 ? "صباحاً" : h < 18 ? "عصراً" : "مساءً";
    return `${from} – ${to} ${part}`;
  }

  const part = h < 12 ? "am" : "pm";
  // A slot never crosses noon or midnight, so one suffix covers both ends.
  return `${from} – ${to} ${part}`;
}
