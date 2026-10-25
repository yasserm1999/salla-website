import { currentStaff } from "@/lib/admin-session";
import { checkHistory } from "@/lib/quality";

export const dynamic = "force-dynamic";

const stamp = (iso: string | null) =>
  iso
    ? new Date(iso)
        .toLocaleString("en-GB", { timeZone: "Asia/Muscat", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .replace(",", "")
    : "";

/**
 * The quality history as a spreadsheet, filtered the same way as the page.
 *
 * CSV with a byte-order mark, so Excel opens it with every name intact.
 */
export async function GET(req: Request) {
  const staff = await currentStaff();
  if (!staff || staff.role !== "owner") return new Response("Not allowed.", { status: 403 });

  const p = new URL(req.url).searchParams;
  const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const res = await checkHistory({
    order: p.get("order")?.trim() || undefined,
    staff: p.get("staff") || undefined,
    from: day(p.get("from")),
    to: day(p.get("to")),
  });
  if (!res.ready) return new Response(res.reason, { status: 503 });

  const rows: unknown[][] = [
    ["Order", "Customer", "Checked by", "Checked at", "Marked ready at", "Late", "Status", "Corrections"],
    ...res.checks.map((c) => [
      c.orderId,
      c.customerName ?? (c.customerId ? `Customer ${c.customerId}` : ""),
      c.staff,
      stamp(c.checkedAt),
      stamp(c.readyAt),
      c.late ? "late" : "",
      c.removedAt ? `withdrawn by ${c.removedBy}` : "standing",
      c.corrections
        .map((x) =>
          x.action === "remove"
            ? `${stamp(x.madeAt)} ${x.madeBy} withdrew it from ${x.fromStaff}${x.reason ? ` (${x.reason})` : ""}`
            : `${stamp(x.madeAt)} ${x.madeBy} moved it ${x.fromStaff} → ${x.toStaff}${x.reason ? ` (${x.reason})` : ""}`
        )
        .join("; "),
    ]),
  ];

  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // A cell starting with = or + would run as a formula in Excel.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Muscat" }).format(new Date());

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-checks-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
