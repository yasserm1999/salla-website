/**
 * The delivery areas, numbered in the order the van works through them.
 *
 * Numbers rather than names because the number is what gets planned with:
 * two customers in 3 and 4 can share a window, a 1 and a 7 cannot. Kept apart
 * from lib/pickups, which is server-only, because the browser needs the list.
 */

export const AREAS = [
  { n: 1, name: "Wadi Kabir" },
  { n: 2, name: "Ruwi / Wattayah" },
  { n: 3, name: "Qurum / Ilam" },
  { n: 4, name: "MSQ / Khuwair / Qurum 29" },
  { n: 5, name: "Bausher / Ansab" },
  { n: 6, name: "Ghala" },
  { n: 7, name: "Muscat Hills" },
] as const;

export const isArea = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= AREAS.length;

export const areaName = (n: number) => AREAS.find((a) => a.n === n)?.name ?? "";

/*
  One colour per area, so a day's list shows at a glance which stops sit
  together. Neighbouring numbers get neighbouring hues for the same reason.
*/
export const AREA_SKIN: Record<number, string> = {
  1: "bg-rose-600",
  2: "bg-orange-500",
  3: "bg-amber-500",
  4: "bg-lime-600",
  5: "bg-emerald-600",
  6: "bg-cyan-600",
  7: "bg-indigo-600",
};
