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

/** An expense is not finished when it is understood — only when it is paid. */
export const isMoney = (kind: IssueKind) => kind === "expense";

export type IssueStatus = "open" | "doing" | "done";
