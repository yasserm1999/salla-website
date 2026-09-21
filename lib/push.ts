import "server-only";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Buzzing a phone that is not looking.
 *
 * The staff screen rings on its own while it is open; this is for the tablet
 * asleep on the wall and the phone in a pocket. Subscriptions belong to the
 * browser, not to us — a device that has been wiped or has revoked permission
 * answers with 404 or 410, and is dropped rather than retried forever.
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

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";

function ready(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:info@sallalaundry.com", pub, priv);
  return true;
}

export async function saveSubscription(input: {
  staff: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string | null;
}): Promise<void> {
  const store = db();
  if (!store) return;
  await store.from("salla_bell_devices").upsert(
    {
      endpoint: input.endpoint,
      staff: input.staff.toLowerCase(),
      p256dh: input.p256dh,
      auth: input.auth,
      label: input.label,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
}

export async function forgetSubscription(endpoint: string): Promise<void> {
  const store = db();
  if (!store) return;
  await store.from("salla_bell_devices").delete().eq("endpoint", endpoint);
}

export type Buzz = {
  title: string;
  body: string;
  ringId: string;
};

/** Buzz every device belonging to the named people. Never throws. */
export async function buzz(staff: string[], message: Buzz): Promise<number> {
  const store = db();
  if (!store || !ready() || staff.length === 0) return 0;

  const { data } = await store
    .from("salla_bell_devices")
    .select("*")
    .in("staff", staff.map((s) => s.toLowerCase()));

  const devices = data ?? [];
  let sent = 0;

  await Promise.all(
    devices.map(async (d) => {
      const row = d as Record<string, unknown>;
      const endpoint = String(row.endpoint);
      try {
        await webpush.sendNotification(
          {
            endpoint,
            keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
          },
          JSON.stringify(message),
          { urgency: "high", TTL: 300 }
        );
        sent += 1;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await forgetSubscription(endpoint);
        else console.error("bell push failed", code);
      }
    })
  );

  return sent;
}
