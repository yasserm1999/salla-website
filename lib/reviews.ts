import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Which orders the owner has already looked at.
 *
 * A rising sales figure tells you something happened but not what. Every order
 * the shop writes up is news until somebody has actually read it, so it sits
 * at the top of the dashboard until it is marked reviewed and then drops out —
 * leaving the board about work rather than about announcements.
 *
 * The table may not exist yet. That reads as "nothing reviewed", which errs
 * the safe way: everything shows, and the page says plainly what is missing.
 */

const TABLE = "salla_order_reviews";

export type ReviewStore =
  | { ready: true; reviewed: Set<string> }
  | { ready: false; reason: string; reviewed: Set<string> };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

const missing = `The ${TABLE} table does not exist yet — run supabase/setup.sql.`;

export async function loadReviewed(): Promise<ReviewStore> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", reviewed: new Set() };

  /*
    Only recent marks are read. An order reviewed in July can never come back
    round — the dashboard only ever asks about orders written in the last few
    days — so carrying the whole history into memory buys nothing.
  */
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from(TABLE)
    .select("order_id")
    .gte("reviewed_at", since);

  if (error) {
    return {
      ready: false,
      reason: isMissingTable(error.code) ? missing : error.message,
      reviewed: new Set(),
    };
  }

  return { ready: true, reviewed: new Set((data ?? []).map((r) => String(r.order_id))) };
}

export async function markReviewed(
  orderIds: string[],
  by: string
): Promise<{ ok: true; marked: number } | { ok: false; error: string }> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true, marked: 0 };

  // Upsert: marking an already-marked order is a no-op, not an error.
  const { error } = await db.from(TABLE).upsert(
    ids.map((id) => ({
      order_id: id,
      reviewed_by: by,
      reviewed_at: new Date().toISOString(),
    })),
    { onConflict: "order_id" }
  );

  if (error) {
    return { ok: false, error: isMissingTable(error.code) ? missing : error.message };
  }
  return { ok: true, marked: ids.length };
}
