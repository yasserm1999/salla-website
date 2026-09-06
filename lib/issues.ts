import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isMoney, type IssueKind, type IssueStatus } from "./issue-kinds";

export { KINDS, KIND_LABEL, isMoney } from "./issue-kinds";
export type { IssueKind, IssueStatus } from "./issue-kinds";

/**
 * Things the shop needs to fix, and ideas for making it better.
 *
 * Whoever notices raises it — the driver at the kerb, the washer at the
 * machine, the owner anywhere — and it is one list, because a fault does not
 * care who found it and two lists would mean two places to forget.
 *
 * Suggestions sit in the same list on purpose. They arrive the same way, from
 * the same people, and a separate box for them is a box nobody opens.
 */

const BUCKET = "salla-issues";

export type Note = { id: string; body: string; by: string; at: string };

export type Issue = {
  id: string;
  kind: IssueKind;
  description: string;
  customerId: string | null;
  customerName: string | null;
  /** Only on an expense: what it cost, as a plain decimal string. */
  amount: string | null;
  /** A link that works for an hour, or null when there is no photo. */
  photoUrl: string | null;
  raisedBy: string;
  raisedAt: string;
  status: IssueStatus;
  assignedTo: string[];
  closedBy: string | null;
  closedAt: string | null;
  notes: Note[];
};

export type IssueStore =
  | { ready: true; issues: Issue[] }
  | { ready: false; reason: string; issues: Issue[] };

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

const missing = "The issue tables do not exist yet — run supabase/issues.sql.";

/**
 * Everything raised, newest first.
 *
 * `mine` narrows it to what one person reported, which is all a worker needs:
 * the shop's whole complaint book is not theirs to read.
 */
export async function loadIssues(mine?: string): Promise<IssueStore> {
  const db = client();
  if (!db) return { ready: false, reason: "Supabase is not configured.", issues: [] };

  let query = db
    .from("salla_issues")
    .select(
      "id, kind, description, amount, customer_id, customer_name, photo_path, raised_by, raised_at, status, assigned_to, closed_by, closed_at"
    )
    .order("raised_at", { ascending: false })
    .limit(200);
  if (mine) query = query.eq("raised_by", mine);

  const { data, error } = await query;
  if (error) {
    return {
      ready: false,
      reason: isMissingTable(error.code) ? missing : error.message,
      issues: [],
    };
  }

  const ids = (data ?? []).map((r) => String(r.id));
  const { data: notes } = ids.length
    ? await db
        .from("salla_issue_notes")
        .select("id, issue_id, body, by_staff, at")
        .in("issue_id", ids)
        .order("at", { ascending: true })
    : { data: [] };

  const byIssue = new Map<string, Note[]>();
  for (const n of notes ?? []) {
    const list = byIssue.get(String(n.issue_id)) ?? [];
    list.push({ id: String(n.id), body: String(n.body), by: String(n.by_staff), at: String(n.at) });
    byIssue.set(String(n.issue_id), list);
  }

  /*
    Photos are kept private and reached through a link signed here. An hour is
    long enough to look at one and short enough that a link pasted somewhere
    it should not be stops working on its own.
  */
  const issues: Issue[] = [];
  for (const r of data ?? []) {
    let photoUrl: string | null = null;
    if (r.photo_path) {
      const { data: signed } = await db.storage
        .from(BUCKET)
        .createSignedUrl(String(r.photo_path), 3600);
      photoUrl = signed?.signedUrl ?? null;
    }

    issues.push({
      id: String(r.id),
      kind: String(r.kind) as IssueKind,
      description: String(r.description),
      customerId: r.customer_id ?? null,
      customerName: r.customer_name ?? null,
      amount: r.amount === null || r.amount === undefined ? null : String(r.amount),
      photoUrl,
      raisedBy: String(r.raised_by),
      raisedAt: String(r.raised_at),
      status: String(r.status) as IssueStatus,
      assignedTo: Array.isArray(r.assigned_to) ? r.assigned_to.map(String) : [],
      closedBy: r.closed_by ?? null,
      closedAt: r.closed_at ?? null,
      notes: byIssue.get(String(r.id)) ?? [],
    });
  }

  return { ready: true, issues };
}

export type Wrote = { ok: true; message: string } | { ok: false; error: string };

function fail(error: { code?: string; message: string }): Wrote {
  return { ok: false, error: isMissingTable(error.code) ? missing : error.message };
}

/**
 * Raise one.
 *
 * The photo arrives as a data URL because the phone that took it has already
 * shrunk it — sending the original off a mobile connection at the kerb is the
 * difference between a report filed and a report abandoned.
 */
export async function raiseIssue(input: {
  kind: IssueKind;
  description: string;
  amount?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  photo?: string | null;
  by: string;
}): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  let photoPath: string | null = null;
  if (input.photo) {
    const match = input.photo.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return { ok: false, error: "That photo is not an image this can store." };

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 5_000_000) {
      return { ok: false, error: "That photo is too big — take it again at a smaller size." };
    }

    const ext = match[1].split("/")[1];
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: match[1], upsert: false });
    if (error) return { ok: false, error: `The photo would not save: ${error.message}` };
    photoPath = path;
  }

  const { error } = await db.from("salla_issues").insert({
    kind: input.kind,
    description: input.description,
    amount: isMoney(input.kind) ? (input.amount ?? null) : null,
    customer_id: input.kind === "customer" ? (input.customerId ?? null) : null,
    customer_name: input.kind === "customer" ? (input.customerName ?? null) : null,
    photo_path: photoPath,
    raised_by: input.by,
  });

  if (error) return fail(error);
  return {
    ok: true,
    message:
      input.kind === "suggestion"
        ? "Suggestion sent."
        : isMoney(input.kind)
          ? "Expense submitted. It shows as unpaid until the shop settles it."
          : "Reported. The shop can see it.",
  };
}

export async function addNote(issueId: string, body: string, by: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };
  const { error } = await db
    .from("salla_issue_notes")
    .insert({ issue_id: issueId, body, by_staff: by });
  if (error) return fail(error);
  return { ok: true, message: "Comment added." };
}

export async function assign(issueId: string, to: string[], by: string): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  // Picking somebody up off an untouched issue starts it, since that is what
  // assigning it means; nothing is dragged backwards out of done.
  const { data: current } = await db
    .from("salla_issues")
    .select("status")
    .eq("id", issueId)
    .single();

  const patch: Record<string, unknown> = { assigned_to: to };
  if (to.length > 0 && current?.status === "open") patch.status = "doing";

  const { error } = await db.from("salla_issues").update(patch).eq("id", issueId);
  if (error) return fail(error);
  return {
    ok: true,
    message: to.length ? `Assigned to ${to.join(" and ")}.` : "Nobody assigned.",
  };
}

export async function setStatus(
  issueId: string,
  status: IssueStatus,
  by: string
): Promise<Wrote> {
  const db = client();
  if (!db) return { ok: false, error: "Supabase is not configured." };

  const patch: Record<string, unknown> = { status };
  if (status === "done") {
    patch.closed_by = by;
    patch.closed_at = new Date().toISOString();
  } else {
    // Reopening clears the closure, so a finished-then-reopened issue does not
    // read as closed by somebody who no longer thinks it is.
    patch.closed_by = null;
    patch.closed_at = null;
  }

  const { error } = await db.from("salla_issues").update(patch).eq("id", issueId);
  if (error) return fail(error);
  return { ok: true, message: status === "done" ? "Marked done." : "Saved." };
}
