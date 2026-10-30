/**
 * What a report can be about.
 *
 * Kept apart from lib/issues on purpose: that module is server-only because it
 * carries the database key, and these names are needed in the browser too. A
 * constant both sides need cannot live in a file one side must never load.
 */

export const KINDS = [
  "inventory",
  "machinery",
  "customer",
  "other",
  "suggestion",
  "expense",
] as const;

export type IssueKind = (typeof KINDS)[number];

export const KIND_LABEL: Record<IssueKind, string> = {
  inventory: "Inventory",
  machinery: "Machine fault",
  customer: "Customer complaint",
  other: "Other",
  suggestion: "Suggestion",
  expense: "Expense",
};

/*
  What can be reported from the form. Inventory has its own stock list now, so
  it is no longer raised as an issue — the kind stays above only so older
  reports still read.
*/
export const RAISE_KINDS: IssueKind[] = KINDS.filter((k) => k !== "inventory");

/**
 * Whether a job of this kind is put on a day.
 *
 * A complaint is kept to be read back later and a suggestion to be thought
 * about; neither is an errand with an hour on it.
 */
export const isScheduled = (kind: IssueKind) => kind !== "customer" && kind !== "suggestion";

/** An expense is not finished when it is understood — only when it is paid. */
export const isMoney = (kind: IssueKind) => kind === "expense";

export type IssueStatus = "open" | "doing" | "done";
