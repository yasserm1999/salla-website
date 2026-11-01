/**
 * How long each garment takes to press, in minutes.
 *
 * Set from the pressing expert's guide — T-shirt 3, trouser 3, dishdasha 5,
 * suit 5, undershirt 1 — and the rest judged against those. Anything that is
 * folded rather than pressed (socks, towels, blankets, carpets) is 0.
 *
 * Matched on the garment alone: "Dishdasha (P)", "Dishdasha (D)" and
 * "Dishdasha (W)" are pressed the same way whether they were washed, dry
 * cleaned, wet cleaned or brought in only to be pressed.
 *
 * Kept apart from the server code because the order lines need it in the
 * browser too. Change a number here and every order shows the new estimate.
 */

const MINUTES: Record<string, number> = {
  // From the expert
  "dishdasha": 5,
  "t-shirt": 3,
  "trouser": 3,
  "undershirt": 1,
  "suit 2 pieces": 5,
  // Worn on top, pressed in full
  "shirt": 4,
  "abaya": 5,
  "abaya dress": 5,
  "blouse": 3,
  "dress": 5,
  "party dress": 7,
  "jacket": 5,
  "coat": 5,
  "overcoat": 5,
  "blazer": 4,
  "suit 3 pieces": 7,
  "suit (top only)": 4,
  "besht": 5,
  "mukhawar": 5,
  "saree": 6,
  "lab coat": 4,
  "uniform (set)": 5,
  "uniform top": 3,
  "military uniform": 5,
  "prayer dress": 4,
  "night gown": 3,
  "skirt": 3,
  "jeans": 3,
  "short": 2,
  "sweater": 2,
  "top": 3,
  "pajamas": 3,
  "pyjama top": 2,
  "overall": 4,
  // Small pieces
  "wizar": 2,
  "shella": 2,
  "musar": 2,
  "gutra": 2,
  "shawl": 2,
  "scarf": 1,
  "tie": 1,
  "kuma": 1,
  "cap": 1,
  "napkin": 1,
  "pillow case": 1,
  // Children's
  "baby plain dress": 1,
  "baby shirt": 1,
  "baby body suit": 1,
  "baby trouser": 1,
  "baby pants": 1,
  "baby short": 1,
  "baby dress": 1,
  "baby toddler": 1,
  "baby jacket": 1,
  "skirt baby": 1,
  "frock baby": 1,
  // Flat linen
  "bed sheet (double)": 4,
  "bed sheet (single)": 3,
  "duvet cover - double": 4,
  "duvet cover - single": 3,
  "large table cloth": 4,
  "table cloths": 3,
  "large curtain": 6,
  // Folded, not pressed
  "underwear": 0,
  "socks": 0,
  "bra": 0,
  "shoes": 0,
  "towel large": 0,
  "towel small": 0,
  "hand towel": 0,
  "bath robe": 0,
  "blanket big (double)": 0,
  "blanket (single)": 0,
  "kids blanket": 0,
  "pillow": 0,
  "sofa pillow": 0,
  "toilet mat": 0,
  "school bag": 0,
  "baby bag": 0,
  "hand bag": 0,
  "tote bag": 0,
  "fabric tote": 0,
  "baby cap": 0,
  "doll (s)": 0,
  "machine made carpets (per meter)": 0,
  "hand tufted carpets (per meter)": 0,
};

/** Anything not on the list: about a T-shirt's worth, and flagged. */
const UNKNOWN = 3;

/** "Dishdasha (P)" → "dishdasha"; "Suit (Top Only) (D)" → "suit (top only)". */
function garment(name: string): string {
  let n = name.trim().toLowerCase();
  // Only the service mark comes off; "(Double)" and "(Top Only)" are part of the name.
  while (/\s*\((p|d|w)\)$/.test(n)) n = n.replace(/\s*\((p|d|w)\)$/, "");
  return n;
}

export type PressLine = { item: string; qty: number; each: number; known: boolean };

/** Every line of an order with its minutes, read off CleanCloud's item summary. */
export function pressLines(summary: string | null): PressLine[] {
  const out: PressLine[] = [];
  for (const part of (summary ?? "").split(" · ")) {
    const m = part.trim().match(/^(.*?)\s+x\s+([\d.]+)$/i);
    if (!m) continue; // discounts, credit and anything else that is not a garment
    const item = m[1].trim();
    const qty = Number(m[2]);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const key = garment(item);
    const known = key in MINUTES;
    out.push({ item, qty, each: known ? MINUTES[key] : UNKNOWN, known });
  }
  return out;
}

/** The whole order's expected pressing time, in minutes. */
export function pressMinutes(summary: string | null): number {
  return Math.round(pressLines(summary).reduce((t, l) => t + l.each * l.qty, 0));
}

/** Who presses. Names as they sign in. */
export const PRESSERS = ["basel", "sonu"];
