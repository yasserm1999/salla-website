"use client";

import { useState } from "react";
import { Star, Send, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Customer feedback form, shared by the English and Arabic pages so the two
 * can never drift apart — only the copy below changes.
 */

type Recommend = "yes" | "maybe" | "no";

const COPY = {
  en: {
    qualityLabel: "Cleaning quality and presentation",
    qualityHint: "How well were the clothes cleaned, pressed and presented?",
    serviceLabel: "Customer service",
    serviceHint: "How were you treated by our team?",
    ratingWords: ["", "Poor", "Fair", "Good", "Very good", "Excellent"],
    recommendLabel: "Would you recommend us to someone?",
    recommendOptions: [
      { value: "yes" as Recommend, label: "Yes" },
      { value: "maybe" as Recommend, label: "Maybe" },
      { value: "no" as Recommend, label: "No" },
    ],
    remarksLabel: "Any remarks?",
    remarksPlaceholder: "Tell us anything — what went well, or what we should fix.",
    nameLabel: "Your name",
    nameHint: "Optional",
    phoneLabel: "Phone number",
    phoneHint: "Optional — only if you would like us to get back to you",
    submit: "Submit",
    submitting: "Sending…",
    required: "Please rate both cleaning quality and customer service before submitting.",
    thanksTitle: "Thank you",
    thanksBody:
      "Your feedback has reached us. If you left your number and asked us to follow up, we will be in touch.",
    another: "Send another response",
    errorTitle: "That did not send",
  },
  ar: {
    qualityLabel: "جودة التنظيف والمظهر",
    qualityHint: "ما مدى جودة تنظيف الملابس وكيّها وتقديمها؟",
    serviceLabel: "خدمة العملاء",
    serviceHint: "كيف كان تعامل فريقنا معك؟",
    ratingWords: ["", "ضعيف", "مقبول", "جيد", "جيد جدًا", "ممتاز"],
    recommendLabel: "هل تنصح أحدًا بالتعامل معنا؟",
    recommendOptions: [
      { value: "yes" as Recommend, label: "نعم" },
      { value: "maybe" as Recommend, label: "ربما" },
      { value: "no" as Recommend, label: "لا" },
    ],
    remarksLabel: "أي ملاحظات؟",
    remarksPlaceholder: "أخبرنا بأي شيء — ما الذي أعجبك، أو ما الذي يجب أن نحسّنه.",
    nameLabel: "اسمك",
    nameHint: "اختياري",
    phoneLabel: "رقم الهاتف",
    phoneHint: "اختياري — فقط إذا رغبت أن نتواصل معك",
    submit: "إرسال",
    submitting: "جارٍ الإرسال…",
    required: "الرجاء تقييم جودة التنظيف وخدمة العملاء قبل الإرسال.",
    thanksTitle: "شكرًا لك",
    thanksBody:
      "وصلتنا ملاحظاتك. إذا تركت رقمك وطلبت التواصل، فسنتواصل معك قريبًا.",
    another: "إرسال رد آخر",
    errorTitle: "لم يتم الإرسال",
  },
} as const;

/** One star-rating question. */
function StarQuestion({
  label,
  hint,
  words,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  words: readonly string[];
  value: number;
  onChange: (n: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className="rounded-[30px] bg-white/90 p-5 shadow-2xl backdrop-blur md:rounded-[34px] md:p-8">
      <legend className="sr-only">{label}</legend>
      <p className="text-lg font-bold text-[#26364d] md:text-xl">
        {label} <span className="text-[#c07a6a]">*</span>
      </p>
      <p className="mt-1 text-sm text-[#546d83]">{hint}</p>

      <div className="mt-5 flex items-center gap-2 md:gap-3" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            aria-label={`${n}`}
            aria-pressed={value === n}
            className="rounded-xl p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#26364d]"
          >
            <Star
              className={`h-9 w-9 md:h-11 md:w-11 ${
                n <= shown ? "fill-[#e0a33e] text-[#e0a33e]" : "text-[#c2ccd4]"
              }`}
            />
          </button>
        ))}

        {shown > 0 && (
          <span className="ms-2 text-sm font-semibold text-[#26364d] md:text-base">
            {words[shown]}
          </span>
        )}
      </div>
    </fieldset>
  );
}

export default function FeedbackForm({ lang }: { lang: "en" | "ar" }) {
  const t = COPY[lang];
  const isAr = lang === "ar";

  const [quality, setQuality] = useState(0);
  const [service, setService] = useState(0);
  const [recommend, setRecommend] = useState<Recommend | null>(null);
  const [remarks, setRemarks] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quality === 0 || service === 0) {
      setError(t.required);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratingQuality: quality,
          ratingService: service,
          recommend,
          remarks,
          name,
          phone,
          language: lang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.message || t.errorTitle);
        return;
      }
      setSent(true);
    } catch {
      setError(t.errorTitle);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-[30px] bg-white/90 p-8 text-center shadow-2xl backdrop-blur md:rounded-[34px] md:p-12">
        <CheckCircle2 className="mx-auto h-14 w-14 text-[#26364d]" />
        <h2 className="mt-5 text-2xl font-bold text-[#26364d] md:text-3xl">{t.thanksTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-[#546d83]">{t.thanksBody}</p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setQuality(0);
            setService(0);
            setRecommend(null);
            setRemarks("");
            setName("");
            setPhone("");
          }}
          className="mt-7 rounded-2xl border border-[#d8e1e7] bg-white px-6 py-3 text-sm font-semibold text-[#26364d] transition hover:scale-[1.02] md:text-base"
        >
          {t.another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 md:space-y-6">
      <StarQuestion
        label={t.qualityLabel}
        hint={t.qualityHint}
        words={t.ratingWords}
        value={quality}
        onChange={setQuality}
      />

      <StarQuestion
        label={t.serviceLabel}
        hint={t.serviceHint}
        words={t.ratingWords}
        value={service}
        onChange={setService}
      />

      {/* Recommend */}
      <fieldset className="rounded-[30px] bg-white/90 p-5 shadow-2xl backdrop-blur md:rounded-[34px] md:p-8">
        <legend className="sr-only">{t.recommendLabel}</legend>
        <p className="text-lg font-bold text-[#26364d] md:text-xl">{t.recommendLabel}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {t.recommendOptions.map((opt) => {
            const active = recommend === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecommend(active ? null : opt.value)}
                aria-pressed={active}
                className={`rounded-2xl border px-4 py-4 text-base font-semibold transition hover:scale-[1.02] ${
                  active
                    ? "border-[#26364d] bg-[#26364d] text-white"
                    : "border-[#d8e1e7] bg-white text-[#26364d]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Remarks and contact */}
      <fieldset className="rounded-[30px] bg-white/90 p-5 shadow-2xl backdrop-blur md:rounded-[34px] md:p-8">
        <legend className="sr-only">{t.remarksLabel}</legend>
        <label className="block">
          <span className="text-lg font-bold text-[#26364d] md:text-xl">{t.remarksLabel}</span>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={t.remarksPlaceholder}
            className="mt-4 w-full rounded-2xl border border-[#d8e1e7] bg-white px-4 py-3 text-base text-[#26364d] outline-none transition focus:border-[#26364d]"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#26364d]">{t.nameLabel}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="mt-2 w-full rounded-2xl border border-[#d8e1e7] bg-white px-4 py-3 text-base text-[#26364d] outline-none transition focus:border-[#26364d]"
            />
            <span className="mt-1 block text-xs text-[#546d83]">{t.nameHint}</span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#26364d]">{t.phoneLabel}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
              maxLength={40}
              className={`mt-2 w-full rounded-2xl border border-[#d8e1e7] bg-white px-4 py-3 text-base text-[#26364d] outline-none transition focus:border-[#26364d] ${
                isAr ? "text-right" : ""
              }`}
            />
            <span className="mt-1 block text-xs text-[#546d83]">{t.phoneHint}</span>
          </label>
        </div>
      </fieldset>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#e5b4ab] bg-[#fdf2f0] px-4 py-3 text-sm font-semibold text-[#a4503c]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#26364d] px-6 py-5 text-base font-semibold text-white transition hover:scale-[1.01] disabled:opacity-60 md:text-lg"
      >
        <Send className="h-5 w-5" />
        {sending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
