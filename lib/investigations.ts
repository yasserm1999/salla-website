import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A memory of which lapsed customers have already been chased.
 *
 * Without it the same names sit at the top of the page every morning and the
 * list stops being read. Closing a case files one absence away — if the
 * customer comes back and then disappears again, the case reopens by itself,
 * because the mark records the order it was closed against.
 *
 * The table may not exist yet. That is treated as "nothing has been
 * investigated" rather than as a failure, so the dashboard still works and
 * says plainly what is missing.
 */

const TABLE = "salla_customer_investigations";

export type Investigation = {
  customerId: string;
  /** Their last order at the moment the case was closed. */
  lastOrderAt: string | null;
  by: string;
  at: string;
};

export type InvestigationStore =
  | { ready: true; marks: Map<string, Investigation> }
  | { ready: false; reason: string };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Postgres says 42P01; PostgREST says PGRST205. Both mean "no such table". */
function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

export async function loadInvestigations(): Promise<InvestigationStore> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured." };

  const { data, error } = await db
    .from(TABLE)
    .select("customer_id, last_order_at, investigated_by, investigated_at");

  if (error) {
    if (isMissingTable(error.code)) {
      return {
        ready: false,
        reason: `The ${TABLE} table does not exist yet — run supabase/customer-investigations.sql.`,
      };
    }
    return { ready: false, reason: error.message };
  }

  const marks = new Map<string, Investigation>();
  for (const row of data ?? []) {
    marks.set(String(row.customer_id), {
      customerId: String(row.customer_id),
      lastOrderAt: row.last_order_at ?? null,
      by: String(row.investigated_by ?? ""),
      at: String(row.investigated_at ?? ""),
    });
  }
  return { ready: true, marks };
}

export async function closeCase(
  customerId: string,
  lastOrderAt: Date | null,
  by: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  // Upsert, not insert: closing an already-closed case should re-date it
  // rather than fail, since the absence being filed away may be a newer one.
  const { error } = await db.from(TABLE).upsert(
    {
      customer_id: customerId,
      last_order_at: lastOrderAt ? lastOrderAt.toISOString() : null,
      investigated_by: by,
      investigated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" }
  );

  if (error) {
    return {
      ok: false,
      error: isMissingTable(error.code)
        ? `The ${TABLE} table does not exist yet — run supabase/customer-investigations.sql.`
        : error.message,
    };
  }
  return { ok: true };
}

export async function reopenCase(
  customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db.from(TABLE).delete().eq("customer_id", customerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Has this absence already been dealt with?
 *
 * Only if the case was closed against an order at least as recent as the one
 * they are currently sitting on. A newer order means they came back, and going
 * quiet again is a fresh case.
 */
export function isSettled(mark: Investigation | undefined, lastOrder: Date): boolean {
  if (!mark) return false;
  if (!mark.lastOrderAt) return true;
  return new Date(mark.lastOrderAt).getTime() >= lastOrder.getTime();
}
