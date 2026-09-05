import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Which orders have been read.
 *
 * A rising sales figure says something was sold; it does not say what. So every
 * order counts as unread until somebody has actually looked at it — and then
 * never again. This is the "and then never again": once an order is marked, it
 * cannot come back, however many times the dashboard is reloaded.
 *
 * If the table is missing that reads as "nothing has been read", which errs the
 * safe way — everything shows, and the page says what is wrong.
 */

const TABLE = "salla_order_reviews";

export type ReviewStore =
  | { ready: true; seen: Set<string> }
  | { ready: false; reason: string; seen: Set<string> };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

const missing = `The ${TABLE} table does not exist yet — run supabase/pickups.sql.`;

export async function loadSeen(): Promise<ReviewStore> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", seen: new Set() };

  /*
    Only the recent past is read. The dashboard never asks about an order more
    than a few days old, so carrying every mark ever made into memory buys
    nothing and grows forever.
  */
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db.from(TABLE).select("order_id").gte("reviewed_at", since);

  if (error) {
    return {
      ready: false,
      reason: isMissingTable(error.code) ? missing : error.message,
      seen: new Set(),
    };
  }
  return { ready: true, seen: new Set((data ?? []).map((r) => String(r.order_id))) };
}

export async function markSeen(
  orderIds: string[],
  by: string
): Promise<{ ok: true; marked: number } | { ok: false; error: string }> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const ids = [...new Set(orderIds.filter(Boolean))].slice(0, 300);
  if (ids.length === 0) return { ok: true, marked: 0 };

  // Upsert: marking one twice is a no-op, not an error worth showing anybody.
  const { error } = await db.from(TABLE).upsert(
    ids.map((id) => ({ order_id: id, reviewed_by: by, reviewed_at: new Date().toISOString() })),
    { onConflict: "order_id" }
  );

  if (error) {
    return { ok: false, error: isMissingTable(error.code) ? missing : error.message };
  }
  return { ok: true, marked: ids.length };
}
