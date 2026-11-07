/**
 * What a lapsed customer said when somebody rang them.
 *
 * Kept apart from lib/investigations on purpose: that module is server-only
 * because it carries the database key, and these names are needed in the
 * browser too.
 *
 * Either they were satisfied, or they had an issue — and an issue always has a
 * reason, so the reason itself is stored as the outcome. "Other" is the one
 * reason that needs the customer's own words, kept in the note.
 */
export const ISSUE_REASONS = ["price", "damaged_clothes", "bad_service", "other"] as const;
export type IssueReason = (typeof ISSUE_REASONS)[number];

export const OUTCOMES = ["satisfied", ...ISSUE_REASONS] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const REASON_LABEL: Record<IssueReason, string> = {
  price: "Price",
  damaged_clothes: "Damaged clothes",
  bad_service: "Bad service",
  other: "Other",
};

export const OUTCOME_LABEL: Record<string, string> = {
  satisfied: "Satisfied",
  price: "Issue: price",
  damaged_clothes: "Issue: damaged clothes",
  bad_service: "Issue: bad service",
  other: "Issue: other",
  // Answers recorded before the reasons existed.
  coming_back: "Said they will come back",
  gone_elsewhere: "Using another laundry",
  had_a_problem: "Had a problem with us",
};

export const isIssue = (o: string | null | undefined): boolean =>
  !!o && o !== "satisfied" && o !== "coming_back";
