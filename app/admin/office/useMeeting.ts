"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgendaItem } from "@/lib/meeting";
import type { Desk } from "@/lib/office";
import { isArabic, type Lang } from "@/lib/office-voices";
import {
  chime,
  forSpeaking,
  parseCommand,
  recogniser,
  speakDetails,
  speakPoint,
  voiceFor,
  voicesReady,
  bestVoiceName,
  type Command,
} from "./voice";

/**
 * The morning meeting as a conversation.
 *
 * One loop runs the meeting: for each point the worker who owns it speaks,
 * then — if the owner's microphone is on — the room waits a few seconds for
 * a question. What the owner says is heard by the browser, answered by Claude
 * as the right worker, and spoken back in that worker's voice. Silence means
 * "carry on", so the owner can drive and say nothing at all.
 *
 * Speaking and listening never overlap: the phone would hear its own
 * speaker. To cut a worker off, the owner taps Talk, which stops the voice
 * and listens straight away.
 *
 * Every step can be abandoned: buttons and voice commands abort whatever is
 * playing or listening, and a meeting that has been ended can never be woken
 * by a timer it left behind.
 */

export type Phase = "idle" | "speaking" | "listening" | "hearing" | "thinking";
export type LogLine = { key: string | null; who: string; text: string };
type Nav = Command | "listen";
type Turn = { role: "user" | "assistant"; content: string };
type Answer = { speaker: string; reply: string; action: Command | "none"; language: Lang };

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res) => {
    const id = window.setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(id);
      res();
    });
  });

export function useMeeting({
  desks,
  agenda,
  onWalkIn,
  onWalkOut,
}: {
  desks: Desk[];
  agenda: AgendaItem[];
  onWalkIn: () => void;
  onWalkOut: () => void;
}) {
  const titles = useMemo(() => Object.fromEntries(desks.map((d) => [d.key, d.title])), [desks]);
  const keys = useMemo(() => new Set(desks.map((d) => d.key)), [desks]);
  const points = useMemo(() => agenda.filter((a) => keys.has(a.presenter)), [agenda, keys]);
  const closing = points.length + 1;

  const [turn, setTurn] = useState<number | null>(null);
  const [detail, setDetail] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState<{ key: string | null; text: string } | null>(null);
  const [hearing, setHearing] = useState("");
  const [log, setLog] = useState<LogLine[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [micOn, setMicOn] = useState(false);
  const [sound, setSound] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [brain, setBrain] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);

  const session = useRef(0);
  const step = useRef<AbortController | null>(null);
  const pending = useRef<Nav | null>(null);
  const resume = useRef<(() => void) | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const history = useRef<Turn[]>([]);
  const narrations = useRef(new Map<string, Promise<string>>());
  // Mirrors of state the async loop reads without waiting for a render.
  const now = useRef({ lang, sound, brain, micOn });
  useEffect(() => {
    now.current = { lang, sound, brain, micOn };
  }, [lang, sound, brain, micOn]);

  useEffect(() => {
    fetch("/api/admin/office/status")
      .then((r) => (r.ok ? r.json() : { brain: false }))
      .then((f) => setBrain(!!f.brain))
      .catch(() => {});
  }, []);

  // Which voice the device will use, so the owner can see whether it is a good one.
  useEffect(() => {
    let live = true;
    void voicesReady().then(() => live && setVoiceName(bestVoiceName(lang)));
    return () => {
      live = false;
    };
  }, [lang]);

  // The figures Claude answers from: what the page already shows, minus the message drafts.
  const data = useMemo(
    () =>
      JSON.stringify({
        agenda: agenda.map((a) => ({
          point: a.number,
          title: a.title,
          presenter: a.presenter,
          headline: a.headline,
          figures: a.stats,
          details: a.lines,
          note: a.note,
        })),
        desks: desks.map((d) => ({
          worker: d.key,
          title: d.title,
          summary: d.headline,
          tasks: d.tasks.map((t) => [t.text, t.detail].filter(Boolean).join(" — ")),
        })),
      }),
    [agenda, desks]
  );

  const say = (line: LogLine) => setLog((l) => [...l.slice(-30), line]);

  // ── Talking ─────────────────────────────────────────────────────────

  /** One worker says one thing; the promise ends when they finish or are cut off. */
  const speak = async (key: string | null, text: string, signal: AbortSignal) => {
    if (signal.aborted || !text) return;
    setCaption({ key, text });
    say({ key, who: key ? (titles[key] ?? key) : "Office", text });
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!now.current.sound || !synth) {
      await sleep(Math.min(9000, 2500 + text.length * 40), signal);
      return;
    }
    setPhase("speaking");
    await voicesReady();
    const arabic = isArabic(text);
    const spoken = forSpeaking(text);
    const who = Math.max(0, desks.findIndex((d) => d.key === key));
    await new Promise<void>((res) => {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(spoken);
      const v = voiceFor(who, arabic ? "ar" : "en");
      if (v) u.voice = v;
      u.lang = v?.lang ?? (arabic ? "ar-OM" : "en-GB");
      u.rate = arabic ? 0.95 : 1;
      let over = false;
      const end = () => {
        if (over) return;
        over = true;
        window.clearTimeout(guard);
        res();
      };
      u.onend = end;
      u.onerror = end;
      signal.addEventListener("abort", () => {
        synth.cancel();
        end();
      });
      // Some browsers never report the end of a long sentence.
      const guard = window.setTimeout(end, Math.max(8000, spoken.length * 110));
      synth.speak(u);
    });
    if (!signal.aborted) setPhase("idle");
  };

  // ── Listening ───────────────────────────────────────────────────────

  const enableMic = () => {
    setProblem(null);
    if (!recogniser()) {
      setProblem("This browser cannot listen. Use Chrome on Android, Safari on iPhone, or Chrome or Edge on a computer.");
      setMicOn(false);
      return false;
    }
    setMicOn(true);
    now.current.micOn = true;
    return true;
  };

  /**
   * Wait for the owner to speak and return what they said, or null after
   * `waitMs` of silence. Words appear on screen while they are being said.
   */
  const listenOnce = (signal: AbortSignal, waitMs: number) =>
    new Promise<string | null>((res) => {
      const Ctor = recogniser();
      if (!Ctor || signal.aborted || !now.current.micOn) return res(null);

      const r = new Ctor();
      r.lang = now.current.lang === "ar" ? "ar-OM" : "en-GB";
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 1;

      let finalText = "";
      let interim = "";
      let started = false;
      let done = false;
      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        window.clearTimeout(quiet);
        setHearing("");
        try {
          r.abort();
        } catch {
          // Already stopped.
        }
        res(value);
      };
      // Nobody started talking in time: carry on.
      const quiet = window.setTimeout(() => {
        if (!started) finish(null);
      }, waitMs);

      r.onspeechstart = () => {
        started = true;
        setPhase("hearing");
      };
      r.onresult = (e) => {
        started = true;
        setPhase("hearing");
        interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const piece = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += piece;
          else interim += piece;
        }
        setHearing((finalText + " " + interim).trim());
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setProblem("The microphone was not allowed. Allow it for this site in the browser, then tap Talk again.");
          setMicOn(false);
          now.current.micOn = false;
        }
        // "no-speech" and "aborted" simply mean nothing was said.
      };
      r.onend = () => finish((finalText || interim).trim() || null);
      signal.addEventListener("abort", () => finish(null));

      setPhase("listening");
      try {
        r.start();
      } catch {
        finish(null);
      }
    });

  // ── Understanding ───────────────────────────────────────────────────

  const askOffice = async (question: string, signal: AbortSignal, point: string | null, narrate = false): Promise<Answer> => {
    const r = await fetch("/api/admin/office/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history: narrate ? [] : history.current, data, point, narrate }),
      signal,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error ?? "The office could not answer.");
    return j as Answer;
  };

  const switchLang = (to: Lang) => {
    setLang(to);
    now.current.lang = to;
  };

  /** Something the owner said: a command, or a question for the office. */
  const handle = async (text: string, signal: AbortSignal, point: string | null): Promise<Command | "none"> => {
    say({ key: null, who: "You", text });

    const command = parseCommand(text);
    if (command === "arabic" || command === "english") {
      switchLang(command === "arabic" ? "ar" : "en");
      await speak("manager", command === "arabic" ? "حاضر، نكمل بالعربي." : "Sure, English from now on.", signal);
      return "repeat";
    }
    if (command) return command;

    if (!now.current.brain) {
      await speak(
        "manager",
        "I can only follow simple commands until Claude is switched on: next, back, repeat, details, pause, or end.",
        signal
      );
      return "none";
    }

    setPhase("thinking");
    try {
      const a = await askOffice(text, signal, point);
      history.current = [
        ...history.current,
        { role: "user" as const, content: text },
        { role: "assistant" as const, content: a.reply },
      ].slice(-16);
      if (a.language !== now.current.lang) switchLang(a.language);
      await speak(keys.has(a.speaker) ? a.speaker : "manager", a.reply, signal);
      return a.action;
    } catch (e) {
      if (signal.aborted) return "none";
      await speak("manager", e instanceof Error ? e.message : "Sorry, I didn't catch that.", signal);
      return "none";
    }
  };

  // ── The meeting ─────────────────────────────────────────────────────

  /** What is said for a step, in the owner's language. */
  const script = async (t: number, wantDetail: boolean, signal: AbortSignal): Promise<{ key: string | null; text: string }> => {
    const arabic = now.current.lang === "ar";
    if (t === 0) {
      return {
        key: "manager",
        text: arabic
          ? `صباح الخير جميعاً. عندنا اليوم ${points.length} مواضيع: ${points.map((p) => p.title).join("، ")}.`
          : `Good morning, everyone. We have ${points.length} things to go through: ${points.map((p) => p.title.toLowerCase()).join(", ")}.`,
      };
    }
    if (t > points.length) {
      return { key: "manager", text: arabic ? "هذا كل شيء. شكراً للجميع، يلا نرجع للشغل!" : "That's everything. Thank you — back to work!" };
    }
    const p = points[t - 1];
    if (!arabic || !now.current.brain) return { key: p.presenter, text: wantDetail ? speakDetails(p) : speakPoint(p) };

    // In Arabic, Claude presents the point; asked once and kept for the meeting.
    const id = `${p.key}|${wantDetail}`;
    let n = narrations.current.get(id);
    if (!n) {
      n = askOffice(
        wantDetail ? `Give the details of point ${p.number}, ${p.title}, in Arabic.` : `Present point ${p.number}, ${p.title}.`,
        signal,
        p.title,
        true
      ).then((a) => a.reply);
      n.catch(() => narrations.current.delete(id));
      narrations.current.set(id, n);
    }
    try {
      return { key: p.presenter, text: await n };
    } catch {
      return { key: p.presenter, text: wantDetail ? speakDetails(p) : speakPoint(p) };
    }
  };

  /** Say a step, then give the owner the floor. Returns what to do next. */
  const present = async (t: number, signal: AbortSignal, opts: { skip: boolean; detail: boolean }): Promise<Nav> => {
    const point = t >= 1 && t <= points.length ? points[t - 1] : null;
    if (!opts.skip) {
      if (point && !opts.detail) chime(audioCtx.current);
      const s = await script(t, opts.detail, signal);
      if (point && !opts.detail) await sleep(400, signal);
      await speak(s.key, s.text, signal);
    }
    if (signal.aborted) return "next";
    if (!now.current.micOn) {
      await sleep(1000, signal);
      return "next";
    }
    // Room for a question after each point; longer when the owner asked to talk.
    for (let round = 0; round < 8 && !signal.aborted; round++) {
      const wait = opts.skip && round === 0 ? 9000 : round > 0 ? 6000 : t === 0 ? 3000 : 5000;
      const heard = await listenOnce(signal, wait);
      if (signal.aborted || !heard) return "next";
      const act = await handle(heard, signal, point?.title ?? null);
      if (act !== "none" && act !== "resume") return act;
    }
    return "next";
  };

  const run = async (mine: number) => {
    let t = 0;
    let skip = false;
    let wantDetail = false;
    while (session.current === mine) {
      setTurn(t);
      setDetail(wantDetail);
      const ctrl = new AbortController();
      step.current = ctrl;
      let nav: Nav = await present(t, ctrl.signal, { skip, detail: wantDetail }).catch(() => "next" as Nav);
      skip = false;
      wantDetail = false;
      if (session.current !== mine) return;
      if (pending.current) {
        nav = pending.current;
        pending.current = null;
      }

      if (nav === "pause") {
        setPaused(true);
        setPhase("idle");
        await new Promise<void>((res) => (resume.current = res));
        resume.current = null;
        setPaused(false);
        if (session.current !== mine) return;
        const after = pending.current;
        pending.current = null;
        if (!after || after === "resume" || after === "pause") continue; // say the same point again
        nav = after;
      }

      if (nav === "end") break;
      if (nav === "listen") skip = true;
      else if (nav === "repeat" || nav === "resume" || nav === "arabic" || nav === "english") continue;
      else if (nav === "details") wantDetail = t >= 1 && t <= points.length;
      else if (nav === "back") t = Math.max(0, t - 1);
      else if (t >= closing) break;
      else t += 1;
    }
    if (session.current === mine) stop();
  };

  // ── Controls ────────────────────────────────────────────────────────

  /** A tap on the page: the browser's permission to make sound from now on. */
  const unlockSound = () => {
    try {
      audioCtx.current ??= new AudioContext();
      void audioCtx.current.resume();
    } catch {
      // No Web Audio: no chime, nothing else lost.
    }
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(" "));
  };

  const start = async (inCar = false) => {
    unlockSound();
    chime(audioCtx.current, [660, 880, 1320]);
    setLog([]);
    setProblem(null);
    history.current = [];
    if (inCar) enableMic();
    const mine = ++session.current;
    pending.current = null;
    setTurn(-1);
    onWalkIn();
    const ctrl = new AbortController();
    step.current = ctrl;
    await sleep(2600, ctrl.signal);
    if (session.current === mine) void run(mine);
  };

  /** End the meeting now, whatever it is doing. */
  const stop = () => {
    session.current++;
    step.current?.abort();
    resume.current?.();
    window.speechSynthesis?.cancel();
    setTurn(null);
    setPaused(false);
    setDetail(false);
    setPhase("idle");
    setCaption(null);
    setHearing("");
    onWalkOut();
  };

  const command = (nav: Nav) => {
    if (turn === null) return;
    pending.current = nav;
    if (resume.current) resume.current();
    else step.current?.abort();
  };

  /** Talk to the office: during the meeting it cuts in; otherwise it is a conversation of its own. */
  const talk = async () => {
    unlockSound();
    if (!enableMic()) return;
    if (turn !== null) {
      command("listen");
      return;
    }
    step.current?.abort();
    window.speechSynthesis?.cancel();
    const ctrl = new AbortController();
    step.current = ctrl;
    for (let round = 0; round < 8 && !ctrl.signal.aborted; round++) {
      const heard = await listenOnce(ctrl.signal, round === 0 ? 9000 : 6000);
      if (!heard || ctrl.signal.aborted) break;
      const act = await handle(heard, ctrl.signal, null);
      if (act === "end") break;
    }
    setPhase("idle");
  };

  const stopTalking = () => {
    if (turn === null) {
      step.current?.abort();
      window.speechSynthesis?.cancel();
      setPhase("idle");
    } else command("pause");
  };

  // Nothing keeps running after the page is closed.
  useEffect(
    () => () => {
      session.current++;
      step.current?.abort();
      window.speechSynthesis?.cancel();
    },
    []
  );

  const point = turn !== null && turn >= 1 && turn <= points.length ? points[turn - 1] : null;

  return {
    points,
    closing,
    turn,
    point,
    detail,
    paused,
    phase,
    caption,
    hearing,
    log,
    lang,
    micOn,
    sound,
    problem,
    brain,
    voiceName,
    titles,
    start,
    stop,
    next: () => command("next"),
    back: () => command("back"),
    repeat: () => command("repeat"),
    details: () => command("details"),
    pause: () => (paused ? command("resume") : command("pause")),
    talk,
    stopTalking,
    setLang: (to: Lang) => {
      switchLang(to);
      if (turn !== null) command("repeat");
    },
    toggleMic: () => (micOn ? setMicOn(false) : void enableMic()),
    toggleSound: () => setSound((s) => !s),
  };
}
