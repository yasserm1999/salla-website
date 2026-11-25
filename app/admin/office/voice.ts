/**
 * The meeting's voice: a chime, the workers reading their points aloud, and
 * the owner talking back.
 *
 * Everything here is the browser's own — speechSynthesis to talk,
 * SpeechRecognition to listen, Web Audio for the chime — so it costs nothing
 * and nothing leaves the phone except what the browser itself sends to
 * recognise speech. Chrome on Android and Safari on iPhone both have it;
 * where a browser lacks listening, the buttons still work.
 *
 * Built for the drive to work: the meeting can be run without looking at the
 * screen, so the spoken words carry the numbers the tiles show.
 */

import type { AgendaItem } from "@/lib/meeting";

export type Command = "next" | "back" | "repeat" | "pause" | "resume" | "details" | "end";

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

/**
 * A voice for each worker. English voices are shared out in turn, and the
 * pitch moves a little either way, so the same voice still sounds like
 * different people round the table.
 */
export function voiceFor(index: number): { voice: SpeechSynthesisVoice | undefined; pitch: number } {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  return {
    voice: voices.length ? voices[index % voices.length] : undefined,
    pitch: [1, 0.85, 1.15, 0.95, 1.25, 0.8, 1.1, 0.9, 1.2][index % 9],
  };
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

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function canListen(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Listen until told to stop. Browsers end a recognition session after a
 * silence, so it is restarted for as long as listening is wanted.
 */
export function listen(
  onHeard: (text: string) => void,
  onProblem: (message: string) => void
): () => void {
  const w = window as unknown as Record<string, new () => Recognition>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    onProblem("This browser cannot listen. Use the buttons instead.");
    return () => {};
  }

  let wanted = true;
  const rec = new Ctor();
  rec.lang = "en-GB";
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) onHeard(e.results[i][0].transcript);
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      wanted = false;
      onProblem("The microphone was not allowed. Allow it in the browser to talk to the meeting.");
    }
  };
  rec.onend = () => {
    if (!wanted) return;
    try {
      rec.start();
    } catch {
      // Already starting again; nothing to do.
    }
  };
  try {
    rec.start();
  } catch {
    onProblem("The microphone could not be started.");
  }

  return () => {
    wanted = false;
    try {
      rec.stop();
    } catch {
      // Already stopped.
    }
  };
}
