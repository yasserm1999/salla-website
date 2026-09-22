"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";

/**
 * The bell, as the car park sees it.
 *
 * One button, thumb-sized, in the middle of the screen — it is pressed from
 * the driver's seat with the engine running, often in the sun, sometimes by
 * somebody who has never seen the page before. Everything else on the page
 * gives way to it.
 *
 * It tells the customer two things and no more: that the bell rang, and that
 * somebody is coming. What they are collecting, and which rack it is on, is
 * the shop's business and appears only on the screen inside.
 */

type Stage = "idle" | "asking" | "ringing" | "coming";

const WORDS = {
  en: {
    eyebrow: "At the shop",
    title: "Ring the bell",
    blurb: "Stay in your car. Press the bell and someone will come out to you.",
    optional: "Customer ID or phone number (optional)",
    hint: "It helps us bring your order out with us.",
    ring: "RING",
    confirmTitle: "Do you want to ring the bell?",
    confirmBlurb: "Someone inside the shop will be alerted straight away.",
    confirm: "Yes, ring it",
    cancel: "Cancel",
    ringing: "Ringing… we're on our way!",
    ringingBlurb: "Please stay where you are. This screen will change when someone is coming out.",
    coming: "Someone is coming out to you",
    comingBlurb: "The bell has been answered and a member of staff is on the way to your car.",
    again: "Nobody came? Ring again",
    already: "Bell already rung — we're coming.",
    failed: "That did not go through. Check your connection and try again.",
    waiting: "Waiting for an answer…",
  },
  ar: {
    eyebrow: "عند المحل",
    title: "اطلب الخدمة",
    blurb: "ابقَ في سيارتك. اضغط الجرس وسيخرج إليك أحد موظفينا.",
    optional: "رقم العميل أو رقم الهاتف (اختياري)",
    hint: "يساعدنا على إحضار طلبك معنا.",
    ring: "اضغط",
    confirmTitle: "هل تريد قرع الجرس؟",
    confirmBlurb: "سيصل التنبيه إلى الموظف داخل المحل فوراً.",
    confirm: "نعم، اقرع الجرس",
    cancel: "إلغاء",
    ringing: "جارٍ التنبيه… نحن في الطريق إليك!",
    ringingBlurb: "يرجى البقاء مكانك. ستتغير هذه الشاشة عند خروج أحد الموظفين.",
    coming: "أحد موظفينا في طريقه إليك",
    comingBlurb: "تم استلام التنبيه، وأحد الموظفين في طريقه إلى سيارتك.",
    again: "لم يأتِ أحد؟ اقرع الجرس مرة أخرى",
    already: "تم قرع الجرس — نحن قادمون.",
    failed: "لم يتم الإرسال. تحقق من الاتصال وحاول مرة أخرى.",
    waiting: "بانتظار الرد…",
  },
} as const;

/** The same set of words, in whichever language the page is in. */
type Words = (typeof WORDS)[keyof typeof WORDS];

/** This phone, as far as the bell is concerned. Kept so two presses are one ring. */
function deviceId(): string {
  const KEY = "salla-bell-device";
  try {
    const kept = localStorage.getItem(KEY);
    if (kept) return kept;
    const made = crypto.randomUUID();
    localStorage.setItem(KEY, made);
    return made;
  } catch {
    // A private window: a new identity each time is better than no bell.
    return crypto.randomUUID();
  }
}

export default function BellView({ lang }: { lang: "en" | "ar" }) {
  const t = WORDS[lang];
  const rtl = lang === "ar";

  const [stage, setStage] = useState<Stage>("idle");
  const [asked, setAsked] = useState("");
  const [ringId, setRingId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const watch = useCallback((id: string) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/bell/ring?id=${id}`, { cache: "no-store" });
        const data = await res.json();
        if (data.status === "coming") {
          setStage("coming");
          if (timer.current) clearInterval(timer.current);
          // A short buzz, for a phone lying on the passenger seat.
          navigator.vibrate?.([120, 60, 120]);
        }
      } catch {
        /* The next tick will do. */
      }
    }, 3000);
  }, []);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  async function press() {
    setSending(true);
    setNote(null);
    try {
      const res = await fetch("/api/bell/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId(), asked: asked.trim() || null, lang }),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 429) {
        setNote(t.already);
        setStage("ringing");
        if (data?.id) {
          setRingId(data.id);
          watch(data.id);
        }
        return;
      }
      if (!res.ok || !data?.id) {
        setNote(t.failed);
        setStage("idle");
        return;
      }

      setRingId(data.id);
      setStage("ringing");
      watch(data.id);
      navigator.vibrate?.(60);
    } catch {
      setNote(t.failed);
      setStage("idle");
    } finally {
      setSending(false);
    }
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[calc(100dvh-5rem)] bg-[#f7f3ed] px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b9925d]">{t.eyebrow}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-[#26364d]">{t.title}</h1>
        <p className="mt-2 text-sm leading-7 text-[#5b6675]">{t.blurb}</p>

        {stage === "coming" ? (
          <Answered t={t} onAgain={() => setStage("idle")} />
        ) : stage === "ringing" ? (
          <Waiting t={t} note={note} />
        ) : (
          <>
            {/* The button itself: round, huge, and the only thing to press. */}
            <button
              onClick={() => setStage("asking")}
              className="group relative mt-10 grid h-60 w-60 place-items-center rounded-full bg-[#26364d] text-white shadow-[0_18px_40px_-12px_rgba(38,54,77,0.6)] transition active:scale-95 sm:h-64 sm:w-64"
            >
              <span className="absolute inset-0 rounded-full ring-8 ring-[#d8b98a]/30 transition group-hover:ring-[#d8b98a]/50" />
              <BellRing className="h-16 w-16" strokeWidth={1.6} aria-hidden />
              <span className="mt-2 text-2xl font-black tracking-wide">{t.ring}</span>
            </button>

            <label className="mt-10 w-full text-start">
              <span className="mb-1.5 block text-sm font-semibold text-[#26364d]">{t.optional}</span>
              <input
                value={asked}
                onChange={(e) => setAsked(e.target.value)}
                inputMode="tel"
                dir="ltr"
                placeholder="9xxxxxxx"
                className="w-full rounded-2xl border border-[#d8cbbd] bg-white px-4 py-3.5 text-base text-[#26364d] outline-none placeholder:text-[#b8b1a8] focus:border-[#d8b98a]"
              />
              <span className="mt-1.5 block text-xs text-[#8a9099]">{t.hint}</span>
            </label>

            {note && (
              <p className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {note}
              </p>
            )}
          </>
        )}
      </div>

      {stage === "asking" && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-4 sm:place-items-center">
          <div
            dir={rtl ? "rtl" : "ltr"}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
          >
            <h2 className="text-xl font-black text-[#26364d]">{t.confirmTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b6675]">{t.confirmBlurb}</p>
            <div className="mt-6 grid gap-2">
              <button
                onClick={press}
                disabled={sending}
                className="rounded-2xl bg-[#26364d] py-4 text-base font-black text-white disabled:opacity-60"
              >
                {sending ? "…" : t.confirm}
              </button>
              <button
                onClick={() => setStage("idle")}
                className="rounded-2xl border border-[#d8cbbd] py-3.5 text-sm font-bold text-[#546d83]"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Waiting({ t, note }: { t: Words; note: string | null }) {
  return (
    <div className="mt-10 w-full">
      <div className="relative mx-auto grid h-60 w-60 place-items-center rounded-full bg-[#d8b98a] text-[#26364d] sm:h-64 sm:w-64">
        {/* Something that plainly keeps moving, so nobody presses twice. */}
        <span className="absolute inset-0 animate-ping rounded-full bg-[#d8b98a]/40" />
        <BellRing className="h-16 w-16 animate-pulse" strokeWidth={1.8} aria-hidden />
      </div>
      <p className="mt-8 text-2xl font-black text-[#26364d]">{note ?? t.ringing}</p>
      <p className="mt-2 text-sm leading-7 text-[#5b6675]">{t.ringingBlurb}</p>
      <p className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-[#8a9099]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t.waiting}
      </p>
    </div>
  );
}

function Answered({ t, onAgain }: { t: Words; onAgain: () => void }) {
  return (
    <div className="mt-10 w-full">
      <div className="mx-auto grid h-60 w-60 place-items-center rounded-full bg-emerald-600 text-white sm:h-64 sm:w-64">
        <Check className="h-20 w-20" strokeWidth={2.2} aria-hidden />
      </div>
      <p className="mt-8 text-2xl font-black text-emerald-700">{t.coming}</p>
      <p className="mt-2 text-sm leading-7 text-[#5b6675]">{t.comingBlurb}</p>
      {/*
        Ringing a second time is allowed the moment the first one is answered:
        being told somebody is coming, and then standing there, is exactly when
        a person needs the bell again.
      */}
      <button
        onClick={onAgain}
        className="mt-8 w-full rounded-2xl bg-[#26364d] px-5 py-4 text-base font-black text-white active:scale-[0.99]"
      >
        {t.again}
      </button>
    </div>
  );
}
