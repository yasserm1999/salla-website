import "server-only";

/**
 * Who may sign off a quality check, and the two digits each one types.
 *
 * Kept here rather than in the page: the PINs are only ever compared on the
 * server, so the browser is sent the names and never the codes. Change a PIN,
 * add someone or take them off by editing this list and redeploying — checks
 * already saved keep the name they were saved with.
 */
/*
  `short` is what the green circle shows. Left out, it is the first three
  letters of the name — enough to tell Sunny from Sonu. Give someone their
  own (two or three letters) when three letters still clash.
*/
export const QUALITY_STAFF: { pin: string; name: string; short?: string }[] = [
  { pin: "12", name: "Sunny" },
  { pin: "34", name: "Basel" },
  { pin: "56", name: "Sonu" },
  { pin: "78", name: "Kumar" },
];

/**
 * The first day quality checks were asked for.
 *
 * Orders marked ready before this were never going to have a check, so the
 * "Ready, not checked" list ignores them instead of opening on weeks of
 * history nobody can do anything about.
 */
export const QUALITY_CHECKS_SINCE = "2026-10-25";
