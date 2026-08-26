import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Who may open the dashboard.
 *
 * A username and password checked against the environment, then a signed
 * cookie so the password is not re-sent on every page. The cookie carries only
 * the username and an expiry, signed with a secret the browser never sees — so
 * it can be read but not forged, and it stops working on its own after a week.
 *
 * This is a shared login for the shop's own staff, not an account system. It
 * is deliberately small; the honest limit is that everyone who signs in is the
 * same person as far as the app is concerned.
 */

const COOKIE = "salla_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Compared byte by byte so the endpoint cannot be probed a character at a time. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;

  // Both are always compared, so a wrong username takes exactly as long as a
  // wrong password and neither can be told apart from the outside.
  const userOk = constantTimeEqual(username, expectedUser);
  const passOk = constantTimeEqual(password, expectedPass);
  return userOk && passOk;
}

export async function startSession(username: string) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ u: username, exp: expires })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentAdmin(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  if (!constantTimeEqual(signature, sign(payload))) return null;

  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || Date.now() > exp) return null;
    return typeof u === "string" ? u : null;
  } catch {
    return null;
  }
}

export function isConfigured(): boolean {
  return !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}
