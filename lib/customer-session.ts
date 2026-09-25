import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * A customer's own session.
 *
 * Kept entirely apart from the staff one: a different cookie, and a signature
 * that says which of the two it is, so a customer's cookie can never be
 * mistaken for a member of staff's however it is tampered with.
 */

const COOKIE = "salla_customer";
const MONTH = 60 * 60 * 24 * 30;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SESSION_SECRET must be set.");
  return s;
}

const sign = (value: string) =>
  createHmac("sha256", secret()).update(`customer|${value}`).digest("base64url");

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Signed in for a month.
 *
 * This is a laundry, not a bank: what is behind the door is your own order
 * numbers and a button that asks the van to call. Being thrown out every week
 * would send more people to the telephone than it would ever protect.
 */
export async function startCustomer(customerId: string): Promise<void> {
  const expires = Date.now() + MONTH * 1000;
  const value = `${customerId}.${expires}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MONTH,
  });
}

export async function endCustomer(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The customer number of whoever is signed in, if anyone. */
export async function currentCustomerId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [id, expires, mac] = parts;
  if (!/^\d{1,6}$/.test(id)) return null;
  if (!same(mac, sign(`${id}.${expires}`))) return null;
  if (Number(expires) < Date.now()) return null;
  return id;
}
