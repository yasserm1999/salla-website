"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  LogOut,
  PackageCheck,
  Shirt,
  Truck,
  WashingMachine,
} from "lucide-react";

/**
 * The customer's own page.
 *
 * Written for somebody standing in a doorway with a bag in one hand. Three
 * things to press, each one a whole sentence, and every answer in plain words:
 * where their washing is, and whether the van is coming.
 *
 * It never asks a question the shop can answer for itself. The address, the
 * telephone number and the orders all come from the counter's own records, so
 * a collection is two taps and a confirmation.
 */

type Order = {
  id: string;
  state: "ready" | "cleaning" | "late";
  pieces: number;
  dueOn: string | null;
  placedOn: string | null;
  daysWaiting: number | null;
};

type Waiting = { id: string; kind: string; onDate: string; atTime: string | null; status: string };

type Me = {
  customer: { id: string; name: string | null; tel: string | null; place: string | null } | null;
  orders: Order[];
  waiting: Waiting[];
  today: string;
  until: string;
};

const WORDS = {
  en: {
    eyebrow: "Your account",
    title: "Salla, at your door",
    signInBlurb: "Sign in with your customer number or your mobile, and the password the shop gave you.",
    who: "Customer number or mobile",
    password: "Password",
    passwordHint: "Your first name, then @, then your customer number — for example Ahmed@216",
    signIn: "Sign in",
    signingIn: "Signing in…",
    hello: "Hello",
    signOut: "Sign out",
    orders: "Your washing",
    noOrders: "Nothing with us at the moment.",
    ready: "Ready",
    cleaning: "Being cleaned",
    late: "Being cleaned",
    pieces: "pieces",
    due: "promised",
    waitingForYou: "waiting for you",
    daysHere: "with us since",
    pickNow: "Collect my clothes today",
    pickNowBlurb: "The van comes to you and takes your washing away.",
    bring: "Bring my order to me",
    bringBlurb: "We deliver what is ready to your address.",
    later: "Book another day",
    laterBlurb: "Choose the day that suits you.",
    confirmPick: "Shall we collect from you today?",
    confirmBring: "Shall we bring your order today?",
    confirmLater: "Which day shall we come?",
    place: "We will come to",
    noPlace: "The shop has no address for you — add a note below and we will call.",
    note: "Anything we should know? (optional)",
    notePlaceholder: "Flat number, best time to call…",
    day: "Day",
    time: "Time — leave blank for any",
    send: "Yes, please come",
    sending: "Sending…",
    cancel: "Not now",
    asked: "We have it. See you then.",
    alreadyAsked: "Already asked for",
    collect: "Collection",
    deliver: "Delivery",
    on: "on",
    changePassword: "Change my password",
    newPassword: "New password",
    save: "Save",
    saved: "Saved. Use it next time.",
    trouble: "Something went wrong. Please try again, or call the shop.",
    today: "today",
    tomorrow: "tomorrow",
  },
  ar: {
    eyebrow: "حسابك",
    title: "صلة، عند بابك",
    signInBlurb: "سجّل الدخول برقم العميل أو رقم هاتفك، وكلمة المرور التي أعطاك إياها المحل.",
    who: "رقم العميل أو الهاتف",
    password: "كلمة المرور",
    passwordHint: "اسمك الأول ثم @ ثم رقم العميل — مثال: Ahmed@216",
    signIn: "دخول",
    signingIn: "جارٍ الدخول…",
    hello: "أهلاً",
    signOut: "خروج",
    orders: "ملابسك لدينا",
    noOrders: "لا يوجد لديك طلبات حالياً.",
    ready: "جاهز",
    cleaning: "قيد الغسيل",
    late: "قيد الغسيل",
    pieces: "قطعة",
    due: "الموعد",
    waitingForYou: "بانتظارك",
    daysHere: "لدينا منذ",
    pickNow: "استلام ملابسي اليوم",
    pickNowBlurb: "تأتي المركبة إليك وتأخذ الغسيل.",
    bring: "أحضروا طلبي إليّ",
    bringBlurb: "نوصّل ما هو جاهز إلى عنوانك.",
    later: "حجز يوم آخر",
    laterBlurb: "اختر اليوم المناسب لك.",
    confirmPick: "هل نأتي لاستلام ملابسك اليوم؟",
    confirmBring: "هل نُحضر طلبك اليوم؟",
    confirmLater: "في أي يوم نأتي؟",
    place: "سنأتي إلى",
    noPlace: "لا يوجد لدينا عنوانك — اكتب ملاحظة وسنتصل بك.",
    note: "هل من ملاحظة؟ (اختياري)",
    notePlaceholder: "رقم الشقة، أفضل وقت للاتصال…",
    day: "اليوم",
    time: "الوقت — اتركه فارغاً لأي وقت",
    send: "نعم، تفضلوا",
    sending: "جارٍ الإرسال…",
    cancel: "ليس الآن",
    asked: "وصلنا طلبك. نراك قريباً.",
    alreadyAsked: "طلبٌ مسجّل",
    collect: "استلام",
    deliver: "توصيل",
    on: "يوم",
    changePassword: "تغيير كلمة المرور",
    newPassword: "كلمة المرور الجديدة",
    save: "حفظ",
    saved: "تم الحفظ. استخدمها في المرة القادمة.",
    trouble: "حدث خطأ. حاول مرة أخرى أو اتصل بالمحل.",
    today: "اليوم",
    tomorrow: "غداً",
  },
} as const;

type Words = (typeof WORDS)[keyof typeof WORDS];
type Ask = { kind: "pickup" | "delivery"; pickDay: boolean } | null;

export default function AccountView({ lang }: { lang: "en" | "ar" }) {
  const t = WORDS[lang];
  const rtl = lang === "ar";

  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [who, setWho] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what: "mine" }),
      });
      setMe(res.ok ? await res.json() : null);
    } catch {
      setMe(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? t.trouble);
        return null;
      }
      return data ?? {};
    } catch {
      setError(t.trouble);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!checked) {
    return (
      <main dir={rtl ? "rtl" : "ltr"} className="grid min-h-[60vh] place-items-center bg-[#f7f3ed]">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#d8cbbd] border-t-[#26364d]" />
      </main>
    );
  }

  if (!me?.customer) {
    return (
      <main dir={rtl ? "rtl" : "ltr"} className="min-h-[70vh] bg-[#f7f3ed] px-5 py-10">
        <div className="mx-auto max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b9925d]">{t.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#26364d]">{t.title}</h1>
          <p className="mt-2 text-sm leading-7 text-[#5b6675]">{t.signInBlurb}</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const done = await send({ what: "login", who, password });
              if (done) {
                setPassword("");
                await load();
              }
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#26364d]">{t.who}</span>
              <input
                value={who}
                onChange={(e) => setWho(e.target.value)}
                inputMode="tel"
                dir="ltr"
                autoComplete="username"
                placeholder="216"
                className="w-full rounded-2xl border border-[#d8cbbd] bg-white px-4 py-3.5 text-base outline-none focus:border-[#d8b98a]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#26364d]">{t.password}</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                dir="ltr"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-[#d8cbbd] bg-white px-4 py-3.5 text-base outline-none focus:border-[#d8b98a]"
              />
              <span className="mt-1.5 block text-xs leading-5 text-[#8a9099]">{t.passwordHint}</span>
            </label>

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              disabled={busy || !who || !password}
              className="w-full rounded-2xl bg-[#26364d] py-4 text-base font-black text-white disabled:opacity-60"
            >
              {busy ? t.signingIn : t.signIn}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const first = (me.customer.name ?? "").trim().split(/\s+/)[0];
  const ready = me.orders.filter((o) => o.state === "ready");

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-[70vh] bg-[#f7f3ed] px-5 py-8">
      <div className="mx-auto max-w-lg">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b9925d]">{t.eyebrow}</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-[#26364d]">
              {t.hello}
              {first ? `، ${first}` : ""}
            </h1>
          </div>
          <button
            onClick={async () => {
              await send({ what: "logout" });
              setMe(null);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#d8cbbd] px-3 py-2 text-xs font-bold text-[#546d83]"
          >
            <LogOut className={`h-3.5 w-3.5 ${rtl ? "-scale-x-100" : ""}`} aria-hidden />
            {t.signOut}
          </button>
        </header>

        {said && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {said}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {/* ── The three things to press ──────────────────────────── */}
        <div className="mt-5 space-y-3">
          <Choice
            icon={<Truck className="h-7 w-7" aria-hidden />}
            title={t.pickNow}
            blurb={t.pickNowBlurb}
            tone="navy"
            rtl={rtl}
            onClick={() => {
              setSaid(null);
              setAsk({ kind: "pickup", pickDay: false });
            }}
          />
          <Choice
            icon={<PackageCheck className="h-7 w-7" aria-hidden />}
            title={t.bring}
            blurb={
              ready.length
                ? `${ready.length} ${ready.length === 1 ? (rtl ? "طلب جاهز" : "order ready") : rtl ? "طلبات جاهزة" : "orders ready"}`
                : t.bringBlurb
            }
            tone="gold"
            rtl={rtl}
            onClick={() => {
              setSaid(null);
              setAsk({ kind: "delivery", pickDay: false });
            }}
          />
          <Choice
            icon={<CalendarClock className="h-7 w-7" aria-hidden />}
            title={t.later}
            blurb={t.laterBlurb}
            tone="plain"
            rtl={rtl}
            onClick={() => {
              setSaid(null);
              setAsk({ kind: "pickup", pickDay: true });
            }}
          />
        </div>

        {/* ── What we already owe them ───────────────────────────── */}
        {me.waiting.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#8a9099]">
              {t.alreadyAsked}
            </h2>
            <ul className="space-y-1.5">
              {me.waiting.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-baseline gap-x-2 rounded-2xl border border-[#ece7e1] bg-white px-4 py-2.5 text-sm"
                >
                  <span className="font-bold text-[#26364d]">
                    {w.kind === "pickup" ? t.collect : t.deliver}
                  </span>
                  <span className="text-[#5b6675]">
                    {t.on} {dayName(w.onDate, me.today, t, lang)}
                    {w.atTime ? ` · ${w.atTime}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Where their washing is ─────────────────────────────── */}
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#8a9099]">
            {t.orders}
          </h2>
          {me.orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d8cbbd] px-4 py-8 text-center text-sm text-[#8a9099]">
              {t.noOrders}
            </p>
          ) : (
            <ul className="space-y-2">
              {me.orders.map((o) => (
                <li
                  key={o.id}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    o.state === "ready"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[#ece7e1] bg-white"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      o.state === "ready" ? "bg-emerald-600 text-white" : "bg-[#f7f3ed] text-[#b9925d]"
                    }`}
                  >
                    {o.state === "ready" ? (
                      <Shirt className="h-5 w-5" aria-hidden />
                    ) : (
                      <WashingMachine className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-[#26364d]">
                      {o.state === "ready" ? t.ready : t.cleaning}
                      <span className="ms-2 text-xs font-semibold text-[#8a9099]">#{o.id}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[#5b6675]">
                      {o.pieces} {t.pieces}
                      {o.state === "ready"
                        ? o.daysWaiting !== null && o.daysWaiting > 0
                          ? ` · ${t.waitingForYou} ${o.daysWaiting} ${rtl ? "يوم" : "d"}`
                          : ` · ${t.waitingForYou}`
                        : o.dueOn
                          ? ` · ${t.due} ${dayName(o.dueOn, me.today, t, lang)}`
                          : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ChangePassword t={t} send={send} busy={busy} onSaved={() => setSaid(t.saved)} />
      </div>

      {ask && (
        <AskSheet
          t={t}
          lang={lang}
          ask={ask}
          me={me}
          busy={busy}
          onClose={() => setAsk(null)}
          onSend={async (onDate, atTime, note) => {
            const done = await send({ what: "ask", kind: ask.kind, onDate, atTime, note });
            if (done) {
              setAsk(null);
              setSaid(t.asked);
              await load();
            }
          }}
        />
      )}
    </main>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────── */

function Choice({
  icon,
  title,
  blurb,
  tone,
  rtl,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  tone: "navy" | "gold" | "plain";
  rtl: boolean;
  onClick: () => void;
}) {
  const skin =
    tone === "navy"
      ? "bg-[#26364d] text-white"
      : tone === "gold"
        ? "bg-[#d8b98a] text-[#26364d]"
        : "border border-[#d8cbbd] bg-white text-[#26364d]";
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-3xl px-5 py-5 text-start transition active:scale-[0.99] ${skin}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black leading-tight">{title}</span>
        <span className={`mt-0.5 block text-xs ${tone === "navy" ? "text-white/70" : "opacity-70"}`}>
          {blurb}
        </span>
      </span>
      {rtl ? (
        <ChevronLeft className="h-5 w-5 shrink-0 opacity-60" aria-hidden />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 opacity-60" aria-hidden />
      )}
    </button>
  );
}

function AskSheet({
  t,
  lang,
  ask,
  me,
  busy,
  onClose,
  onSend,
}: {
  t: Words;
  lang: "en" | "ar";
  ask: NonNullable<Ask>;
  me: Me;
  busy: boolean;
  onClose: () => void;
  onSend: (onDate: string, atTime: string | null, note: string | null) => void;
}) {
  const [day, setDay] = useState(me.today);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");

  const heading = ask.pickDay ? t.confirmLater : ask.kind === "pickup" ? t.confirmPick : t.confirmBring;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-3 sm:place-items-center">
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-xl font-black text-[#26364d]">{heading}</h2>

        <p className="mt-3 rounded-2xl bg-[#f7f3ed] px-4 py-3 text-sm leading-6 text-[#26364d]">
          {me.customer?.place ? (
            <>
              <span className="font-bold">{t.place}:</span> {me.customer.place}
            </>
          ) : (
            t.noPlace
          )}
        </p>

        {ask.pickDay && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8a9099]">
                {t.day}
              </span>
              <input
                type="date"
                value={day}
                min={me.today}
                max={me.until}
                onChange={(e) => setDay(e.target.value)}
                className="w-full rounded-2xl border border-[#d8cbbd] px-4 py-3 text-base outline-none focus:border-[#d8b98a]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8a9099]">
                {t.time}
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-2xl border border-[#d8cbbd] px-4 py-3 text-base outline-none focus:border-[#d8b98a]"
              />
            </label>
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#8a9099]">
            {t.note}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            className="w-full rounded-2xl border border-[#d8cbbd] px-4 py-3 text-base outline-none focus:border-[#d8b98a]"
          />
        </label>

        <div className="mt-5 grid gap-2">
          <button
            onClick={() => onSend(ask.pickDay ? day : me.today, time || null, note || null)}
            disabled={busy}
            className="rounded-2xl bg-[#26364d] py-4 text-base font-black text-white disabled:opacity-60"
          >
            {busy ? t.sending : t.send}
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-[#d8cbbd] py-3 text-sm font-bold text-[#546d83]"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePassword({
  t,
  send,
  busy,
  onSaved,
}: {
  t: Words;
  send: (body: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-8 w-full text-center text-xs font-bold text-[#8a9099] underline underline-offset-4"
      >
        {t.changePassword}
      </button>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-[#ece7e1] bg-white p-4">
      <p className="text-sm font-bold text-[#26364d]">{t.changePassword}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="password"
          dir="ltr"
          placeholder={t.newPassword}
          className="w-full rounded-xl border border-[#d8cbbd] px-3 py-2.5 text-sm outline-none focus:border-[#d8b98a]"
        />
        <button
          onClick={async () => {
            const done = await send({ what: "password", password: value });
            if (done) {
              setValue("");
              setOpen(false);
              onSaved();
            }
          }}
          disabled={busy || value.length < 6}
          className="shrink-0 rounded-xl bg-[#26364d] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}

/** "today", "tomorrow", or a date somebody can picture. */
function dayName(day: string, today: string, t: Words, lang: "en" | "ar"): string {
  if (day === today) return t.today;
  const gap = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (gap === 1) return t.tomorrow;
  return new Date(Date.parse(`${day}T12:00:00Z`)).toLocaleDateString(
    lang === "ar" ? "ar-OM-u-nu-latn" : "en-GB",
    { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
  );
}
