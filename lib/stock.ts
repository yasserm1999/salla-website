import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * What the shop has on the shelf.
 *
 * Anybody who works here can add an item, say more came in, or say they used
 * some — the person at the shelf is the one who knows. The count is the sum of
 * those entries rather than a number anyone types over, so it can always be
 * read back to who took what and when.
 */

export type StockMove = {
  id: string;
  kind: "in" | "used" | "count";
  change: number;
  note: string | null;
  by: string;
  at: string;
};

export type StockItem = {
  id: string;
  name: string;
  unit: string | null;
  lowAt: number | null;
  onHand: number;
  createdBy: string;
  /** Newest first, the last few only. */
  moves: StockMove[];
};

export type StockStore =
  | { ready: true; items: StockItem[] }
  | { ready: false; reason: string; items: StockItem[] };

export type Wrote = { ok: true; message: string } | { ok: false; error: string };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const missing = "The stock tables do not exist yet — run supabase/stock.sql.";

function fail(error: { code?: string; message: string }): Wrote {
  const gone = error.code === "42P01" || error.code === "PGRST205";
  return { ok: false, error: gone ? missing : error.message };
}

// Three decimals is what the column holds; adding floats drifts past that.
const round = (n: number) => Math.round(n * 1000) / 1000;

export async function loadStock(): Promise<StockStore> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", items: [] };

  const { data: items, error } = await db
    .from("salla_stock_items")
    .select("id, name, unit, low_at, created_by")
    .is("removed_at", null)
    .order("name", { ascending: true });
  if (error) {
    const r = fail(error);
    return { ready: false, reason: r.ok ? "" : r.error, items: [] };
  }

  const ids = (items ?? []).map((i) => String(i.id));
  const { data: moves } = ids.length
    ? await db
        .from("salla_stock_moves")
        .select("id, item_id, kind, change, note, by_staff, at")
        .in("item_id", ids)
        .order("at", { ascending: false })
    : { data: [] };

  const total = new Map<string, number>();
  const recent = new Map<string, StockMove[]>();
  for (const m of moves ?? []) {
    const id = String(m.item_id);
    total.set(id, (total.get(id) ?? 0) + Number(m.change));
    const list = recent.get(id) ?? [];
    if (list.length < 8) {
      list.push({
        id: String(m.id),
        kind: m.kind as StockMove["kind"],
        change: Number(m.change),
        note: (m.note as string) ?? null,
        by: String(m.by_staff),
        at: String(m.at),
      });
    }
    recent.set(id, list);
  }

  return {
    ready: true,
    items: (items ?? []).map((i) => ({
      id: String(i.id),
      name: String(i.name),
      unit: (i.unit as string) ?? null,
      lowAt: i.low_at === null || i.low_at === undefined ? null : Number(i.low_at),
      onHand: round(total.get(String(i.id)) ?? 0),
      createdBy: String(i.created_by),
      moves: recent.get(String(i.id)) ?? [],
    })),
  };
}

async function onHand(itemId: string): Promise<number | null> {
  const db = client();
  if (!db) return null;
  const { data, error } = await db.from("salla_stock_moves").select("change").eq("item_id", itemId);
  if (error) return null;
  return round((data ?? []).reduce((s, m) => s + Number(m.change), 0));
}

export async function addItem(input: {
  name: string;
  unit: string | null;
  lowAt: number | null;
  quantity: number;
  by: string;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const { data, error } = await db
    .from("salla_stock_items")
    .insert({ name: input.name, unit: input.unit, low_at: input.lowAt, created_by: input.by })
    .select("id")
    .single();
  if (error) return fail(error);

  if (input.quantity > 0) {
    const { error: e } = await db.from("salla_stock_moves").insert({
      item_id: data.id,
      kind: "in",
      change: input.quantity,
      note: "Starting count",
      by_staff: input.by,
    });
    if (e) return fail(e);
  }
  return { ok: true, message: `${input.name} added.` };
}

/**
 * More came in, or some was used.
 *
 * Using more than the count says is there is refused rather than let through
 * as a negative: either the count is wrong or the number typed is, and an
 * owner putting the count right is the fix for both.
 */
export async function move(input: {
  itemId: string;
  kind: "in" | "used";
  quantity: number;
  note: string | null;
  by: string;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  if (input.kind === "used") {
    const have = await onHand(input.itemId);
    if (have !== null && input.quantity > have) {
      return {
        ok: false,
        error: `Only ${have} left on the list. Ask the owner to correct the count first.`,
      };
    }
  }

  const { error } = await db.from("salla_stock_moves").insert({
    item_id: input.itemId,
    kind: input.kind,
    change: input.kind === "used" ? -input.quantity : input.quantity,
    note: input.note,
    by_staff: input.by,
  });
  if (error) return fail(error);
  return { ok: true, message: input.kind === "used" ? "Use recorded." : "Added to stock." };
}

/** An owner counts the shelf and says what is really there. */
export async function setCount(itemId: string, counted: number, by: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const have = await onHand(itemId);
  if (have === null) return { ok: false, error: "Could not read the current count." };
  const change = round(counted - have);
  if (change === 0) return { ok: true, message: "The count was already right." };

  const { error } = await db.from("salla_stock_moves").insert({
    item_id: itemId,
    kind: "count",
    change,
    note: `Counted: ${counted} (was ${have})`,
    by_staff: by,
  });
  if (error) return fail(error);
  return { ok: true, message: "Count corrected." };
}

export async function removeItem(itemId: string, by: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db
    .from("salla_stock_items")
    .update({ removed_at: new Date().toISOString(), removed_by: by })
    .eq("id", itemId);
  if (error) return fail(error);
  return { ok: true, message: "Taken off the list." };
}
