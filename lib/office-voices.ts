/**
 * The meeting's languages. Shared by the page and the server: the owner
 * picks Arabic or English, the browser listens in that language, and Claude
 * answers in it.
 */

export type Lang = "en" | "ar";

/** Arabic script anywhere in what was said means it was said in Arabic. */
export const isArabic = (text: string) => /[؀-ۿ]/.test(text);
