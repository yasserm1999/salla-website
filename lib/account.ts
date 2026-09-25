import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assess,
  defaultWindow,
  fetchCustomers,
  fetchOrders,
  shopYmd,
  tidyAddress,
} from "./cleancloud";
import { addJob, addPerson, loadSpan, shopToday, shiftDay } from "./pickups";
import { SLOTS, SLOT_CAPACITY, isSlot } from "./slots";

/**
 * The customer's own side of the shop.
 *
 * Every customer CleanCloud knows about can sign in already: the password is
 * their first name and their customer number, which the shop can read out over
 * the counter without keeping a list of secrets. Anyone who would rather have
 * their own sets one, and from then on that is the only one that works.
 *
 * What they can do here is deliberately short — see their orders, ask for a
 * collection, ask for their washing to be brought round. Everything they ask
 * for lands in the same list the shop already drives from.
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

export type Customer = {
  id: string;
  name: string | null;
  tel: string | null;
  place: string | null;
};

/** Their washing, as they are allowed to see it: no racks, no shop notes. */
export type MyOrder = {
  id: string;
  state: "ready" | "cleaning" | "late";
  pieces: number;
  /** The day it was promised, as YYYY-MM-DD. */
  dueOn: string | null;
  placedOn: string | null;
  daysWaiting: number | null;
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Arabic keyboards, spaces, +968 — all the same number. */
export function digitsOnly(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

export function asPhone(raw: string): string | null {
  const digits = digitsOnly(raw).replace(/^00/, "");
  const bare = digits.startsWith("968") && digits.length > 8 ? digits.slice(3) : digits;
  return /^\d{8}$/.test(bare) ? bare : null;
}

/**
 * The password the shop can tell someone over the counter.
 *
 * First name and customer number, which both parties already know. Compared
 * without regard to case or the spaces people put around things, because a
 * password nobody can type is a telephone call for the shop.
 */
export function defaultPassword(name: string | null, id: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0] || "customer";
  return `${first}@${id}`;
}

const tidy = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function hash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function hashMatches(password: string, stored: string): boolean {
  const [salt, want] = stored.split(":");
  if (!salt || !want) return false;
  const wanted = Buffer.from(want, "hex");
  const got = scryptSync(password, salt, wanted.length);
  return wanted.length === got.length && timingSafeEqual(wanted, got);
}

/* ── Finding who is at the door ──────────────────────────────────── */

/**
 * The customer behind a number.
 *
 * A short number is a customer number. Eight digits is a telephone, and
 * CleanCloud cannot search by telephone — so the shop's own book answers that,
 * and the customers seen on recent orders answer the rest.
 */
export async function findCustomer(input: string): Promise<Customer | null> {
  const phone = asPhone(input);
  const digits = digitsOnly(input);

  if (!phone && /^\d{1,6}$/.test(digits)) {
    const found = await fetchCustomers([digits]);
    const brief = found.get(digits);
    if (!brief || (!brief.name && !brief.tel)) return null;
    return { id: digits, name: brief.name, tel: brief.tel, place: brief.place };
  }

  if (!phone) return null;

  const store = db();
  if (store) {
    const { data } = await store
      .from("salla_people")
      .select("name, phone, address, cleancloud_id")
      .not("cleancloud_id", "is", null)
      .limit(2000);
    const hit = (data ?? []).find((p) => asPhone(String((p as { phone?: string }).phone ?? "")) === phone);
    if (hit) {
      const row = hit as { name?: string; address?: string; cleancloud_id?: string };
      const id = String(row.cleancloud_id);
      // The book may be out of date on the name; CleanCloud decides.
      const brief = (await fetchCustomers([id])).get(id);
      return {
        id,
        name: brief?.name ?? text(row.name ?? null),
        tel: brief?.tel ?? phone,
        place: brief?.place ?? tidyAddress(text(row.address ?? null)),
      };
    }
  }

  return null;
}

/* ── Letting them in ─────────────────────────────────────────────── */

export type SignIn =
  | { ok: true; customer: Customer }
  | { ok: false; error: "unknown" | "wrong" | "tooMany" };

const TRY_WINDOW = 15 * 60_000;

async function note(subject: string, ok: boolean): Promise<void> {
  const store = db();
  if (!store) return;
  await store.from("salla_login_tries").insert({ subject, ok });
}

async function tooMany(subject: string, limit: number): Promise<boolean> {
  const store = db();
  if (!store) return false;
  const { count } = await store
    .from("salla_login_tries")
    .select("id", { count: "exact", head: true })
    .eq("subject", subject)
    .eq("ok", false)
    .gte("at", new Date(Date.now() - TRY_WINDOW).toISOString());
  return (count ?? 0) >= limit;
}

/**
 * Sign in, or say no slowly.
 *
 * The password is guessable by design — a first name and a customer number
 * are not secrets — so the guard is the number of attempts rather than the
 * strength of the answer: ten wrong guesses at one customer, or thirty from
 * one address, and the door stays shut for a quarter of an hour.
 */
export async function signIn(who: string, password: string, ip: string | null): Promise<SignIn> {
  const from = ip ? `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}` : null;
  if (from && (await tooMany(from, 30))) return { ok: false, error: "tooMany" };

  const customer = await findCustomer(who);
  if (!customer) {
    if (from) await note(from, false);
    return { ok: false, error: "unknown" };
  }

  const subject = `id:${customer.id}`;
  if (await tooMany(subject, 10)) return { ok: false, error: "tooMany" };

  const store = db();
  let good = false;

  const { data: own } = store
    ? await store
        .from("salla_customer_logins")
        .select("password_hash")
        .eq("customer_id", customer.id)
        .maybeSingle()
    : { data: null };

  if (own) {
    good = hashMatches(password, String((own as { password_hash: string }).password_hash));
  } else {
    good = tidy(password) === tidy(defaultPassword(customer.name, customer.id));
  }

  await note(subject, good);
  if (from) await note(from, good);

  return good ? { ok: true, customer } : { ok: false, error: "wrong" };
}

export async function setPassword(customerId: string, password: string): Promise<boolean> {
  const store = db();
  if (!store || password.length < 6) return false;
  const { error } = await store
    .from("salla_customer_logins")
    .upsert(
      { customer_id: customerId, password_hash: hash(password), changed_at: new Date().toISOString() },
      { onConflict: "customer_id" }
    );
  return !error;
}

/* ── What they came to see ───────────────────────────────────────── */

const DAY = 86_400_000;

export async function myOrders(customerId: string): Promise<MyOrder[]> {
  const { from, to } = defaultWindow();
  let orders;
  try {
    orders = await fetchOrders(from, to);
  } catch {
    return [];
  }

  const today = Date.parse(`${shopToday()}T12:00:00Z`);

  return orders
    .filter((o) => o.customerID === customerId)
    .map((o) => assess(o))
    .filter((a) => a.urgency !== "collected")
    .map((a) => ({
      id: a.id,
      state: (a.urgency === "ready" ? "ready" : a.urgency === "late" ? "late" : "cleaning") as MyOrder["state"],
      pieces: a.pieces,
      dueOn: a.dueAt ? shopYmd(a.dueAt) : null,
      placedOn: a.createdAt ? shopYmd(a.createdAt) : null,
      daysWaiting:
        a.urgency === "ready" && a.cleanedAt
          ? Math.max(0, Math.round((today - Date.parse(`${shopYmd(a.cleanedAt)}T12:00:00Z`)) / DAY))
          : null,
    }))
    .sort((x, y) => (x.state === "ready" && y.state !== "ready" ? -1 : x.state !== "ready" && y.state === "ready" ? 1 : 0));
}

/* ── What they can ask for ───────────────────────────────────────── */

/**
 * The shop's own record of this customer.
 *
 * Errands hang off the shop's book rather than off CleanCloud, so a customer
 * asking for the first time is written into the book as they ask. Their
 * telephone and address come along, because the van needs both.
 */
async function personFor(customer: Customer): Promise<string | null> {
  const store = db();
  if (!store) return null;

  const { data } = await store
    .from("salla_people")
    .select("id")
    .eq("cleancloud_id", customer.id)
    .maybeSingle();
  if (data) return String((data as { id: string }).id);

  const made = await addPerson({
    name: customer.name ?? `Customer ${customer.id}`,
    phone: customer.tel,
    address: customer.place,
  });
  if (!made.ok || !made.id) return null;

  await store.from("salla_people").update({ cleancloud_id: customer.id }).eq("id", made.id);
  return made.id;
}

/**
 * The hours still open on a given day.
 *
 * Three errands an hour is what the van can actually do, so an hour with three
 * already booked is not offered at all — a customer should not have to discover
 * that their choice was refused. Collections and deliveries count together,
 * because the van cannot be in two places whichever it is doing.
 *
 * Today loses its hours as they pass. An hour that has already started is no
 * longer a promise anybody can keep.
 */
export async function freeSlots(onDate: string): Promise<string[]> {
  const board = await loadSpan(onDate, onDate);
  const taken = new Map<string, number>();

  if (board.ready) {
    for (const job of board.data.jobs) {
      if (job.status === "cancelled" || !job.atTime) continue;
      taken.set(job.atTime, (taken.get(job.atTime) ?? 0) + 1);
    }
  }

  const now = new Date();
  const minutesNow =
    onDate === shopToday()
      ? (() => {
          const hhmm = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Muscat",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(now);
          const [h, m] = hhmm.split(":").map(Number);
          return h * 60 + m;
        })()
      : -1;

  return SLOTS.filter((slot) => {
    if ((taken.get(slot) ?? 0) >= SLOT_CAPACITY) return false;
    const [h, m] = slot.split(":").map(Number);
    return h * 60 + m > minutesNow;
  });
}

export type Asked =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Anything this customer has already asked for and not yet had. */
export async function openRequests(customerId: string): Promise<
  { id: string; kind: string; onDate: string; atTime: string | null; status: string }[]
> {
  const board = await loadSpan(shopToday(), shiftDay(shopToday(), 14));
  if (!board.ready) return [];
  return board.data.jobs
    .filter(
      (j) =>
        j.person.cleanCloudId === customerId &&
        (j.status === "waiting" || j.status === "out")
    )
    .map((j) => ({ id: j.id, kind: j.kind, onDate: j.onDate, atTime: j.atTime, status: j.status }));
}

/**
 * Ask the van to come.
 *
 * `kind` is what the van is coming for: a collection, or bringing washing
 * back. The second is a request rather than a booking — deliveries are
 * arranged in CleanCloud by the shop — so it joins the day's list as
 * something to plan, and somebody inside decides when.
 */
export async function askFor(input: {
  customer: Customer;
  kind: "pickup" | "delivery";
  onDate: string;
  atTime: string | null;
  note: string | null;
}): Promise<Asked> {
  const today = shopToday();
  if (input.onDate < today || input.onDate > shiftDay(today, 14)) {
    return { ok: false, error: "Choose a day within the next two weeks." };
  }

  if (input.atTime !== null) {
    if (!isSlot(input.atTime)) return { ok: false, error: "Choose one of the times offered." };
    /*
      Checked again here, not only when the list was drawn. Two people can be
      looking at the same free hour at the same moment, and the second one
      should be told rather than quietly making a fourth stop.
    */
    const free = await freeSlots(input.onDate);
    if (!free.includes(input.atTime)) {
      return { ok: false, error: "That time has just been taken. Please choose another." };
    }
  }

  const already = await openRequests(input.customer.id);
  const clash = already.find((r) => r.kind === input.kind && r.onDate === input.onDate);
  if (clash) {
    return {
      ok: false,
      error:
        input.kind === "pickup"
          ? "You have already asked us to collect on that day."
          : "You have already asked us to bring your order on that day.",
    };
  }

  const personId = await personFor(input.customer);
  if (!personId) return { ok: false, error: "We could not save that. Please call the shop." };

  const made = await addJob({
    personId,
    kind: input.kind,
    onDate: input.onDate,
    atTime: input.atTime,
    note: input.note,
    fromCustomer: true,
  });

  return made.ok
    ? { ok: true, message: made.message }
    : { ok: false, error: made.error };
}
