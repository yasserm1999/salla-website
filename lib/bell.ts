import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assess, defaultWindow, fetchCustomers, fetchOrders, type Assessed } from "./cleancloud";

/**
 * The bell in the car park.
 *
 * A customer waiting outside presses one button and somebody inside comes
 * out. Everything else here exists to make that one press useful: who is
 * outside, what they are collecting, which rack it sits on — and none of that
 * is ever shown in the car park, only on the screen indoors.
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/** Who the bell is for. A name here must match an account in ADMIN_USERS. */
export function bellStaff(): string[] {
  return (process.env.BELL_STAFF ?? "sonu")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isBellStaff(name: string, role: string): boolean {
  const list = bellStaff();
  // Owners can always watch the bell, so a ring is never stranded.
  return role === "owner" || list.includes(name.toLowerCase());
}

/** One order as the person answering the bell needs to see it. */
export type BellOrder = {
  id: string;
  ready: boolean;
  rack: string | null;
  pieces: number;
  /** "today", "tomorrow", "late" — only for work still in the shop. */
  when: string | null;
  daysOnRack: number | null;
};

export type Ring = {
  id: string;
  at: string;
  asked: string | null;
  customerName: string | null;
  customerId: string | null;
  lang: "en" | "ar";
  ackAt: string | null;
  ackBy: string | null;
  /** Filled in for the staff screen only, never for the car park. */
  orders?: BellOrder[];
};

type Row = Record<string, unknown>;

const toRing = (r: Row): Ring => ({
  orders: Array.isArray(r.orders) ? (r.orders as BellOrder[]) : [],
  id: String(r.id),
  at: String(r.created_at),
  asked: (r.asked as string) ?? null,
  customerName: (r.customer_name as string) ?? null,
  customerId: (r.customer_id as string) ?? null,
  lang: r.lang === "ar" ? "ar" : "en",
  ackAt: (r.ack_at as string) ?? null,
  ackBy: (r.ack_by as string) ?? null,
});

/**
 * An Omani mobile as eight digits, however it was typed.
 *
 * People write their own number six different ways — with the country code,
 * with spaces, with a dash, on an Arabic keyboard. The bell is not the place
 * to teach them a format.
 */
export function tidyPhone(raw: string): string | null {
  const latin = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const digits = latin.replace(/\D/g, "").replace(/^00/, "");
  const bare = digits.startsWith("968") && digits.length > 8 ? digits.slice(3) : digits;
  return /^\d{8}$/.test(bare) ? bare : null;
}

export type Found = {
  customerId: string | null;
  name: string | null;
  orders: BellOrder[];
};

/**
 * Who is outside, worked out from whatever they typed.
 *
 * A short number is a CleanCloud customer number; anything that looks like a
 * mobile is matched against the shop's own book first, because CleanCloud has
 * no way to search by telephone. A number nobody recognises still rings the
 * bell — somebody is standing outside either way.
 */
export async function lookup(asked: string): Promise<Found> {
  const empty: Found = { customerId: null, name: null, orders: [] };
  const text = asked.trim();
  if (!text) return empty;

  const phone = tidyPhone(text);
  const digits = text.replace(/\D/g, "");
  let customerId: string | null = null;
  /*
    A name we already hold. CleanCloud rate-limits customer lookups hard, and
    a refusal in that moment must not turn a known customer into an unknown
    one on the screen inside.
  */
  let known: string | null = null;

  // A bare short number is a customer number: c216, 216, #216.
  if (!phone && /^\d{1,6}$/.test(digits)) customerId = digits;

  if (!customerId && phone) {
    const store = db();
    if (store) {
      /*
        The shop's own book, which does hold telephone numbers. Matched on the
        last eight digits so a row saved as +968… still answers.
      */
      const { data } = await store
        .from("salla_people")
        .select("name, phone, cleancloud_id")
        .not("cleancloud_id", "is", null)
        .limit(1000);
      const hit = (data ?? []).find((p) => {
        const theirs = tidyPhone(String((p as Row).phone ?? ""));
        return theirs && theirs === phone;
      });
      if (hit) {
        customerId = String((hit as Row).cleancloud_id);
        known = (hit as Row).name ? String((hit as Row).name) : null;
      }
    }
  }

  if (!customerId) return empty;

  if (!known) {
    const store = db();
    if (store) {
      const { data } = await store
        .from("salla_people")
        .select("name")
        .eq("cleancloud_id", customerId)
        .maybeSingle();
      if (data) known = String((data as Row).name);
    }
  }

  // What they are here for. Their own orders only, and only the open ones.
  const { from, to } = defaultWindow();
  let mine: Assessed[] = [];
  let name: string | null = null;
  try {
    const orders = await fetchOrders(from, to);
    mine = orders
      .filter((o) => o.customerID === customerId)
      .map((o) => assess(o))
      .filter((a) => a.urgency !== "collected");
    const who = await fetchCustomers([customerId]);
    name = who.get(customerId)?.name ?? null;
  } catch {
    // CleanCloud being slow or cross must not stop the bell ringing.
    return { customerId, name: known, orders: [] };
  }

  const orders: BellOrder[] = mine
    .map((a) => ({
      id: a.id,
      ready: a.urgency === "ready",
      rack: a.rack,
      pieces: a.pieces,
      when: a.urgency === "ready" ? null : a.urgency,
      daysOnRack: a.daysOnRack,
    }))
    .sort((x, y) => Number(y.ready) - Number(x.ready));

  return { customerId, name: name ?? known, orders };
}

const MINUTE = 60_000;

export type RingResult =
  | { ok: true; id: string }
  | { ok: false; tooSoon: true; ringId: string | null }
  | { ok: false; tooSoon: false; error: string };

/**
 * Ring it.
 *
 * One press per device every two minutes: pressing again because nobody has
 * come yet is exactly what a person does, and it must not turn into five
 * alerts on the tablet. The earlier ring is handed back instead, so the car
 * park keeps watching the same one.
 */
export async function ring(input: {
  deviceId: string;
  ip: string | null;
  asked: string | null;
  lang: "en" | "ar";
}): Promise<RingResult> {
  const store = db();
  if (!store) return { ok: false, tooSoon: false, error: "Supabase is not configured." };

  const since = new Date(Date.now() - 2 * MINUTE).toISOString();
  const { data: recent } = await store
    .from("salla_bell_rings")
    .select("id, created_at")
    .eq("device_id", input.deviceId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    return { ok: false, tooSoon: true, ringId: String((recent[0] as Row).id) };
  }

  // One machine ringing over and over is not a customer.
  const ipHash = input.ip ? createHash("sha256").update(input.ip).digest("hex").slice(0, 32) : null;
  if (ipHash) {
    const { count } = await store
      .from("salla_bell_rings")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 10 * MINUTE).toISOString());
    if ((count ?? 0) >= 5) {
      return { ok: false, tooSoon: true, ringId: null };
    }
  }

  const found = input.asked ? await lookup(input.asked) : { customerId: null, name: null, orders: [] };

  const { data, error } = await store
    .from("salla_bell_rings")
    .insert({
      device_id: input.deviceId,
      ip_hash: ipHash,
      asked: input.asked,
      customer_id: found.customerId,
      customer_name: found.name,
      orders: found.orders,
      lang: input.lang,
    })
    .select("id")
    .single();

  if (error) return { ok: false, tooSoon: false, error: error.message };
  return { ok: true, id: String(data.id) };
}

/** What the car park may know: whether somebody is on their way. */
export async function ringStatus(id: string): Promise<"ringing" | "coming" | "gone"> {
  const store = db();
  if (!store || !/^[0-9a-f-]{36}$/i.test(id)) return "gone";
  const { data } = await store
    .from("salla_bell_rings")
    .select("ack_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return "gone";
  return (data as Row).ack_at ? "coming" : "ringing";
}

/**
 * The bell's last hour, for the screen indoors.
 *
 * Answered rings stay on the list for a while rather than vanishing: the
 * person who went out wants to see that it was theirs, and the shop wants to
 * know how long the car park waited.
 */
export async function recentRings(): Promise<Ring[]> {
  const store = db();
  if (!store) return [];
  const { data } = await store
    .from("salla_bell_rings")
    .select("*")
    .gte("created_at", new Date(Date.now() - 60 * MINUTE).toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => toRing(r as Row));
}

/**
 * The bell's last hour, for the screen inside.
 *
 * What each customer was collecting was worked out once, when they pressed
 * the button, and written down with the ring. The screen indoors asks for
 * this list every three seconds, and looking the customer up again each time
 * would mean asking CleanCloud twenty times a minute for an answer that
 * cannot have changed while somebody stands in the car park.
 */
export async function waitingRings(): Promise<Ring[]> {
  return recentRings();
}

export async function acknowledge(id: string, by: string): Promise<boolean> {
  const store = db();
  if (!store || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const { error } = await store
    .from("salla_bell_rings")
    .update({ ack_at: new Date().toISOString(), ack_by: by })
    .eq("id", id)
    .is("ack_at", null);
  return !error;
}
