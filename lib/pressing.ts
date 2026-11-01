import "server-only";
import { createClient } from "@supabase/supabase-js";
import { pressMinutes } from "./press-minutes";

/**
 * Pressing, order by order.
 *
 * An owner or the manager allocates an order to one of the pressers; the
 * presser presses done when it is finished and is credited with the minutes
 * the garments are worth. The daily report is those credits added up.
 */

export type Pressing = {
  orderId: string;
  customerId: string | null;
  summary: string | null;
  minutes: number;
  assignedTo: string | null;
  assignedAt: string | null;
  doneAt: string | null;
  doneBy: string | null;
};

export type Wrote = { ok: true; message: string } | { ok: false; error: string };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const COLUMNS = "order_id, customer_id, summary, minutes, assigned_to, assigned_at, done_at, done_by";

const toPressing = (r: Record<string, unknown>): Pressing => ({
  orderId: String(r.order_id),
  customerId: (r.customer_id as string) ?? null,
  summary: (r.summary as string) ?? null,
  minutes: Number(r.minutes ?? 0),
  assignedTo: (r.assigned_to as string) ?? null,
  assignedAt: (r.assigned_at as string) ?? null,
  doneAt: (r.done_at as string) ?? null,
  doneBy: (r.done_by as string) ?? null,
});

function fail(error: { code?: string; message: string }): Wrote {
  const gone = error.code === "42P01" || error.code === "PGRST205";
  return { ok: false, error: gone ? "The pressing table does not exist yet — run supabase/pressing.sql." : error.message };
}

/** Where every order on screen stands, keyed by order number. */
export async function pressingFor(orderIds: string[]): Promise<Record<string, Pressing>> {
  const db = client();
  if (!db || orderIds.length === 0) return {};
  const out: Record<string, Pressing> = {};
  // In slices, so a long board does not make one enormous URL.
  for (let i = 0; i < orderIds.length; i += 200) {
    const { data } = await db.from("salla_pressing").select(COLUMNS).in("order_id", orderIds.slice(i, i + 200));
    for (const r of data ?? []) out[String(r.order_id)] = toPressing(r);
  }
  return out;
}

/** Everything finished between two moments, and everything still allocated. */
export async function pressingReport(fromIso: string, toIso: string): Promise<{
  done: Pressing[];
  open: Pressing[];
  ready: boolean;
}> {
  const db = client();
  if (!db) return { done: [], open: [], ready: false };
  const [done, open] = await Promise.all([
    db.from("salla_pressing").select(COLUMNS).gte("done_at", fromIso).lt("done_at", toIso).order("done_at"),
    db.from("salla_pressing").select(COLUMNS).is("done_at", null).not("assigned_to", "is", null).order("assigned_at"),
  ]);
  if (done.error) return { done: [], open: [], ready: false };
  return {
    done: (done.data ?? []).map(toPressing),
    open: (open.data ?? []).map(toPressing),
    ready: true,
  };
}

export async function getPressing(orderId: string): Promise<Pressing | null> {
  const db = client();
  if (!db) return null;
  const { data } = await db.from("salla_pressing").select(COLUMNS).eq("order_id", orderId).maybeSingle();
  return data ? toPressing(data) : null;
}

/** Give an order to a presser, or take it back (to = null). */
export async function allocate(input: {
  orderId: string;
  customerId: string | null;
  summary: string | null;
  to: string | null;
  by: string;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const current = await getPressing(input.orderId);
  if (current?.doneAt) return { ok: false, error: "That order is already pressed." };

  const { error } = await db.from("salla_pressing").upsert({
    order_id: input.orderId,
    customer_id: input.customerId,
    summary: input.summary,
    minutes: pressMinutes(input.summary),
    assigned_to: input.to,
    assigned_by: input.to ? input.by : null,
    assigned_at: input.to ? new Date().toISOString() : null,
  });
  if (error) return fail(error);
  return { ok: true, message: input.to ? `#${input.orderId} given to ${input.to}.` : `#${input.orderId} taken back.` };
}

/**
 * Pressed. The credit goes to whoever it was allocated to — when an owner
 * presses done on somebody's behalf, it is still that person's work.
 */
export async function finish(orderId: string, by: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const current = await getPressing(orderId);
  if (!current?.assignedTo) return { ok: false, error: "Allocate it to somebody first." };
  if (current.doneAt) return { ok: true, message: "Already done." };

  const { error } = await db
    .from("salla_pressing")
    .update({ done_at: new Date().toISOString(), done_by: by })
    .eq("order_id", orderId);
  if (error) return fail(error);
  return { ok: true, message: `Done — ${current.minutes} min to ${current.assignedTo}.` };
}

/** An owner takes back a done that was pressed by mistake. */
export async function undo(orderId: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db.from("salla_pressing").update({ done_at: null, done_by: null }).eq("order_id", orderId);
  if (error) return fail(error);
  return { ok: true, message: "Done taken back." };
}
