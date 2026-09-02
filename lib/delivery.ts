import "server-only";
import { createClient } from "@supabase/supabase-js";
import { dueWindowEnd, shopMinutesNow, shopYmd } from "./cleancloud";
import type { Run } from "./cleancloud";

/**
 * What the driver is doing, and how long ago the shop last heard it.
 *
 * CleanCloud knows an order is a delivery and knows when somebody eventually
 * marks it collected. It knows nothing about the hour in between — whether the
 * van has left, which parcel is in it now, or whether a customer was out. That
 * hour is the whole of the shop's exposure, so it is tracked here.
 *
 * Two clocks are kept for every event. happened_at is the driver's own device
 * at the moment he tapped; recorded_at is when it reached the server. Out of
 * signal those diverge, and the gap between them is the honest measure of how
 * stale the shop's picture was — so it is shown rather than smoothed over.
 */

const TABLE = "salla_delivery_events";

export type EventKind = "on_the_way" | "delivered" | "failed";

export type DeliveryEvent = {
  orderId: string | null;
  day: string;
  kind: EventKind;
  reason: string | null;
  by: string;
  /** The driver's clock when it happened. */
  at: string;
  /** When the server heard about it. Later than `at` if he was out of signal. */
  recordedAt: string;
};

export type EventStore =
  | { ready: true; events: DeliveryEvent[] }
  | { ready: false; reason: string; events: DeliveryEvent[] };

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

const missing = `The ${TABLE} table does not exist yet — run supabase/setup.sql.`;

export async function loadEvents(day = shopYmd(new Date())): Promise<EventStore> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", events: [] };

  const { data, error } = await db
    .from(TABLE)
    .select("order_id, run_day, event, reason, by_staff, happened_at, recorded_at")
    .eq("run_day", day)
    .order("happened_at", { ascending: true });

  if (error) {
    return { ready: false, reason: isMissingTable(error.code) ? missing : error.message, events: [] };
  }

  return {
    ready: true,
    events: (data ?? []).map((r) => ({
      orderId: r.order_id === null ? null : String(r.order_id),
      day: String(r.run_day),
      kind: String(r.event) as EventKind,
      reason: r.reason ?? null,
      by: String(r.by_staff ?? ""),
      at: String(r.happened_at),
      recordedAt: String(r.recorded_at),
    })),
  };
}

export type IncomingEvent = {
  orderId: string | null;
  kind: EventKind;
  reason?: string | null;
  /** The device's clock. Trusted, but sanity-checked before it is stored. */
  at: string;
  day: string;
};

/**
 * Save a batch.
 *
 * A batch, because a driver who has been out of signal will send everything he
 * did at once the moment it comes back. Nothing is updated in place — the
 * table is a record of what happened, and a parcel that went out, failed, and
 * went out again should read exactly like that.
 */
export async function saveEvents(
  events: IncomingEvent[],
  by: string
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  if (events.length === 0) return { ok: true, saved: 0 };

  const now = Date.now();
  const rows = events.map((e) => {
    /*
      A device clock can be wrong, and a wrong one would put a delivery in next
      week. Anything outside a day either side of now is not believed, and the
      arrival time is used instead — being slightly wrong about when is better
      than losing the fact that it happened.
    */
    const claimed = Date.parse(e.at);
    const believable =
      Number.isFinite(claimed) && Math.abs(claimed - now) < 36 * 60 * 60 * 1000;

    return {
      order_id: e.orderId,
      run_day: e.day,
      event: e.kind,
      reason: e.reason ?? null,
      by_staff: by,
      happened_at: new Date(believable ? claimed : now).toISOString(),
    };
  });

  const { error } = await db.from(TABLE).insert(rows);
  if (error) {
    return { ok: false, error: isMissingTable(error.code) ? missing : error.message };
  }
  return { ok: true, saved: rows.length };
}

// ── Reading the day off the events ─────────────────────────────────────

export type StopState = "waiting" | "onTheWay" | "delivered" | "failed";

export type StopProgress = {
  state: StopState;
  /** When it went out, if it has. */
  leftAt: string | null;
  /** When it was settled one way or the other. */
  settledAt: string | null;
  reason: string | null;
  /** Minutes the shop was in the dark about the latest event. */
  reportingLagMinutes: number;
};

export function progressByOrder(events: DeliveryEvent[]): Map<string, StopProgress> {
  const out = new Map<string, StopProgress>();

  for (const e of events) {
    if (!e.orderId) continue;
    const row =
      out.get(e.orderId) ??
      ({
        state: "waiting",
        leftAt: null,
        settledAt: null,
        reason: null,
        reportingLagMinutes: 0,
      } as StopProgress);

    if (e.kind === "on_the_way") {
      row.state = "onTheWay";
      row.leftAt = e.at;
      // A parcel sent out again after a failure is genuinely out again.
      row.settledAt = null;
      row.reason = null;
    } else if (e.kind === "delivered") {
      row.state = "delivered";
      row.settledAt = e.at;
    } else if (e.kind === "failed") {
      row.state = "failed";
      row.settledAt = e.at;
      row.reason = e.reason;
    }

    const lag = (Date.parse(e.recordedAt) - Date.parse(e.at)) / 60000;
    if (Number.isFinite(lag)) row.reportingLagMinutes = Math.max(0, Math.round(lag));

    out.set(e.orderId, row);
  }

  return out;
}

export type RunStatus = {
  /**
   * When the round began.
   *
   * Taken as the first parcel that went out rather than a separate "I am
   * leaving" tap. The driver marks parcels one at a time, and the moment the
   * first one is in the van is the moment the shop's exposure starts — a
   * button saying he is about to leave would only be one more thing to forget.
   */
  startedAt: string | null;
  /** The latest thing the shop heard, from anywhere. */
  lastHeardAt: string | null;
  /** How long since the shop heard anything at all, in minutes. */
  silentForMinutes: number | null;
  outCount: number;
  deliveredCount: number;
  failedCount: number;
  waitingCount: number;
};

export function runStatus(
  runs: Run[],
  events: DeliveryEvent[],
  now = new Date()
): RunStatus {
  const today = shopYmd(now);
  const stops = runs.filter((r) => r.day === today).flatMap((r) => r.stops);
  const progress = progressByOrder(events);

  const started = events.find((e) => e.kind === "on_the_way");
  const latest = events.reduce<string | null>(
    (best, e) => (best === null || Date.parse(e.at) > Date.parse(best) ? e.at : best),
    null
  );

  let out = 0;
  let delivered = 0;
  let failed = 0;
  let waiting = 0;
  for (const stop of stops) {
    const state = progress.get(stop.id)?.state ?? "waiting";
    if (state === "onTheWay") out += 1;
    else if (state === "delivered") delivered += 1;
    else if (state === "failed") failed += 1;
    else waiting += 1;
  }

  return {
    startedAt: started?.at ?? null,
    lastHeardAt: latest,
    silentForMinutes:
      latest === null ? null : Math.max(0, Math.round((now.getTime() - Date.parse(latest)) / 60000)),
    outCount: out,
    deliveredCount: delivered,
    failedCount: failed,
    waitingCount: waiting,
  };
}

// ── What the shop can tell without hearing from the driver ─────────────

export type Concern = {
  level: "urgent" | "watch";
  headline: string;
  detail: string;
  orderIds: string[];
};

/**
 * Trouble the shop can see for itself.
 *
 * This is the part that matters most. A driver out of signal cannot tell
 * anyone anything, and waiting for him to come back and mark up the system is
 * finding out too late by definition. But the promised windows are known and
 * so is the time, so the shop can work out on its own that three parcels were
 * due by eight and nothing has been marked — without the driver touching
 * anything.
 *
 * Silence is treated as information rather than as nothing.
 */
export function deliveryConcerns(runs: Run[], events: DeliveryEvent[], now = new Date()): Concern[] {
  const today = shopYmd(now);
  const stops = runs.filter((r) => r.day === today).flatMap((r) => r.stops);
  if (stops.length === 0) return [];

  const progress = progressByOrder(events);
  const status = runStatus(runs, events, now);
  const minutesNow = shopMinutesNow(now);
  const concerns: Concern[] = [];

  const unsettled = stops.filter((s) => {
    const state = progress.get(s.id)?.state ?? "waiting";
    return state === "waiting" || state === "onTheWay";
  });

  // Past its promised hour and still not accounted for.
  const overdue = unsettled.filter((s) => {
    const end = dueWindowEnd(s.dueTimeLabel);
    return end !== null && minutesNow > end;
  });
  if (overdue.length > 0) {
    concerns.push({
      level: "urgent",
      headline: `${overdue.length} past the promised hour`,
      detail: "Nothing has been marked delivered for these, and their window has gone.",
      orderIds: overdue.map((s) => s.id),
    });
  }

  // Still in the shop with the hour closing in.
  const notOutYet = unsettled.filter((s) => {
    const end = dueWindowEnd(s.dueTimeLabel);
    const state = progress.get(s.id)?.state ?? "waiting";
    return (
      state === "waiting" && end !== null && end - minutesNow > 0 && end - minutesNow <= 45
    );
  });
  if (notOutYet.length > 0) {
    concerns.push({
      level: "watch",
      headline: `${notOutYet.length} due within the hour, not out yet`,
      detail: "These have not been marked on the way.",
      orderIds: notOutYet.map((s) => s.id),
    });
  }

  /*
    Nobody has touched the phone for a while with parcels in the van. That is
    the usual shape of a driver out of signal, and it is worth saying plainly
    rather than leaving the page looking calm.
  */
  if (status.outCount > 0 && (status.silentForMinutes ?? 0) >= 45) {
    concerns.push({
      level: "watch",
      headline: `Nothing heard for ${status.silentForMinutes} minutes`,
      detail: `${status.outCount} parcel${status.outCount === 1 ? "" : "s"} still showing as on the way. He may be out of signal.`,
      orderIds: [],
    });
  }

  // Nothing has gone out at all and the first promise is close.
  if (status.startedAt === null) {
    const soonest = stops
      .map((s) => dueWindowEnd(s.dueTimeLabel))
      .filter((m): m is number => m !== null)
      .sort((a, b) => a - b)[0];
    if (soonest !== undefined && soonest - minutesNow <= 90) {
      concerns.push({
        level: soonest < minutesNow ? "urgent" : "watch",
        headline: "Nothing has left the shop",
        detail: `${stops.length} stop${stops.length === 1 ? "" : "s"} today and not one has been marked on the way.`,
        orderIds: [],
      });
    }
  }

  return concerns;
}
