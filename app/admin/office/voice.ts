/**
 * The meeting's voice: a chime, the workers reading their points aloud, and
 * the owner talking back.
 *
 * Speaking and listening are the browser's own — speechSynthesis to talk,
 * SpeechRecognition to listen, Web Audio for the chime. The only outside
 * service is Claude, which understands and answers. Chrome on Android and
 * Safari on iPhone both listen; where a browser cannot, the buttons work.
 *
 * Built for the drive to work: the meeting can be run without looking at the
 * screen, so the spoken words carry the numbers the tiles show.
 */

import type { AgendaItem } from "@/lib/meeting";

export type Command = "next" | "back" | "repeat" | "pause" | "resume" | "details" | "end" | "arabic" | "english";

/**
 * What was heard, as a command, or null.
 *
 * Only short phrases count. The phone hears its own speaker too, and a
 * worker's sentence that happens to contain "next" must not skip a point —
 * so the whole phrase has to be a command, not merely include one.
 */
export function parseCommand(heard: string): Command | null {
  const t = heard
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .trim();
  if (!t || t.split(/\s+/).length > 4) return null;

  const is = (...words: string[]) => words.some((w) => t === w || t === `${w} please` || t === `please ${w}`);
  if (is("next", "next point", "next one", "skip", "go on", "move on", "التالي", "بعده")) return "next";
  if (is("back", "go back", "previous", "last one", "ارجع", "السابق")) return "back";
  if (is("repeat", "again", "say again", "say that again", "what", "كرر", "عيد")) return "repeat";
  if (is("pause", "wait", "hold on", "hold", "stop talking", "انتظر", "وقف")) return "pause";
  if (is("continue", "carry on", "resume", "go ahead", "play", "كمل", "استمر")) return "resume";
  if (is("details", "more", "tell me more", "more details", "which ones", "explain", "تفاصيل", "اكثر")) return "details";
  if (is("end", "end meeting", "stop meeting", "finish", "stop", "that's all", "انهي", "خلاص")) return "end";
  if (is("arabic", "speak arabic", "in arabic", "عربي", "بالعربي", "عربي لو سمحت")) return "arabic";
  if (is("english", "speak english", "in english", "انجليزي", "إنجليزي", "بالانجليزي", "بالإنجليزي")) return "english";
  return null;
}

/** Numbers and symbols the way a person would say them. */
export function forSpeaking(text: string): string {
  return text
    .replace(/▼\s*/g, "down ")
    .replace(/▲\s*/g, "up ")
    .replace(/(\d+)h (\d+)m/g, (_, h, m) => `${h} hours ${m} minutes`)
    .replace(/(\d+) min\b/g, "$1 minutes")
    .replace(/#(\d+)/g, "order $1")
    .replace(/→/g, ", scored")
    .replace(/—/g, ", ")
    .replace(/·/g, ", ");
}

/** A point read out in full: the line, then each figure. */
export function speakPoint(item: AgendaItem): string {
  const figures = item.stats
    .map((s) => `${s.label}: ${s.value}${s.sub ? `, ${s.sub}` : ""}`)
    .join(". ");
  return forSpeaking(`${item.number}. ${item.title}. ${item.headline} ${figures}.`);
}

/** The point's details read out: the lines under it, at most six of them. */
export function speakDetails(item: AgendaItem): string {
  if (!item.lines.length) return `There are no more details on ${item.title.toLowerCase()}.`;
  const lines = item.lines
    .slice(0, 6)
    .map((l) => `${l.text}${l.detail ? `: ${l.detail}` : ""}`)
    .join(". ");
  const more = item.lines.length > 6 ? ` And ${item.lines.length - 6} more on the screen.` : "";
  return forSpeaking(`Details. ${lines}.${more}`);
}

// ── Voices ─────────────────────────────────────────────────────────────

/**
 * How natural a voice sounds, judged from its name.
 *
 * Every phone and computer carries a robotic default and, often, much better
 * voices beside it: Edge's "Online (Natural)" voices, Chrome's "Google"
 * voices, iPhone "Enhanced" and "Premium" voices. Those are picked first.
 */
function naturalness(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 8;
  if (/premium/.test(n)) s += 7;
  if (/enhanced/.test(n)) s += 6;
  if (/online/.test(n)) s += 3;
  if (/google/.test(n)) s += 4;
  if (/siri/.test(n)) s += 5;
  // Novelty voices are never a colleague.
  if (/bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|organ|superstar|wobble|jester|albert|bahh/.test(n)) s -= 20;
  return s;
}

export function voicesFor(lang: "en" | "ar"): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  const wanted = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  // Gulf voices first for Arabic, British then American for English.
  const local = (v: SpeechSynthesisVoice) =>
    lang === "ar"
      ? /ar[-_](om|ae|sa|qa|kw|bh)/i.test(v.lang) ? 1 : 0
      : /en[-_]gb/i.test(v.lang) ? 1 : /en[-_]us/i.test(v.lang) ? 0.5 : 0;
  return wanted.sort((a, b) => naturalness(b) + local(b) - (naturalness(a) + local(a)));
}

/** Voices load a moment after the page; wait for them once. */
export function voicesReady(): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((res) => {
    const done = () => res();
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, 1500);
  });
}

/**
 * A voice for each worker: the best natural voices are shared out in turn so
 * the people round the table sound different. Pitch is left alone — bending
 * it is what makes good voices sound robotic.
 */
export function voiceFor(index: number, lang: "en" | "ar"): SpeechSynthesisVoice | undefined {
  const list = voicesFor(lang);
  if (!list.length) return undefined;
  const best = naturalness(list[0]);
  // Only voices nearly as good as the best are used, however many workers there are.
  const good = list.filter((v) => naturalness(v) >= best - 2);
  return good[index % good.length];
}

/** The name of the voice in use, so the owner can tell what the device offers. */
export function bestVoiceName(lang: "en" | "ar"): string | null {
  return voicesFor(lang)[0]?.name ?? null;
}

/** A two-note chime: the meeting opening, or a new point. */
export function chime(ctx: AudioContext | null, notes = [880, 1320]) {
  if (!ctx) return;
  const t = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = t + i * 0.16;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.75);
  });
}

// ── Listening ──────────────────────────────────────────────────────────

export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onspeechstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

/** The browser's speech recogniser, where it has one. */
export function recogniser(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => Recognition>;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}