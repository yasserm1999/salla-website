"use client";

import { useMemo, useState } from "react";
import { Calculator, Droplets, RotateCcw, Shirt, Sparkles } from "lucide-react";
import {
  CATEGORIES,
  GARMENTS,
  categoryName,
  garmentName,
  type CatId,
  type Locale,
  type Method,
} from "../data/pricing";

const UI = {
  en: {
    title: "Price Calculator",
    subtitle:
      "Select your items, add quantities, and calculate your estimated total in OMR.",
    item: "Item",
    normalWash: "Normal Wash",
    hydroDry: "Hydro Dry Clean",
    wetClean: "WET Clean",
    mobile: { normal: ["Normal", "Wash"], dry: ["Hydro", "Dry"], wet: ["WET", "Clean"] },
    estimatedTotal: "Estimated Total",
    reset: "Reset",
    currency: "OMR",
  },
  ar: {
    title: "حاسبة الأسعار",
    subtitle:
      "اختر أصنافك، أضف الكميات، واحسب إجماليك التقديري بالريال العُماني.",
    item: "الصنف",
    normalWash: "الغسيل العادي",
    hydroDry: "التنظيف الجاف بالهيدروكربون",
    wetClean: "التنظيف الرطب الاحترافي",
    mobile: { normal: ["غسيل", "عادي"], dry: ["هيدرو", "جاف"], wet: ["تنظيف", "رطب"] },
    estimatedTotal: "الإجمالي التقديري",
    reset: "إعادة تعيين",
    currency: "ر.ع.",
  },
} as const;

type Quantities = Record<string, { normal: number; dry: number; wet: number }>;

export default function CalculatorView({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = UI[locale];

  const [activeCategory, setActiveCategory] = useState<CatId>(CATEGORIES[0].id);
  const [quantities, setQuantities] = useState<Quantities>({});

  const visibleItems = GARMENTS.filter((g) => g.cat === activeCategory);

  const updateQuantity = (key: string, service: Method, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: {
        normal: prev[key]?.normal || 0,
        dry: prev[key]?.dry || 0,
        wet: prev[key]?.wet || 0,
        [service]: value,
      },
    }));
  };

  const total = useMemo(() => {
    return GARMENTS.reduce((sum, g) => {
      const q = quantities[g.en] || { normal: 0, dry: 0, wet: 0 };
      return (
        sum +
        (g.normal ? q.normal * g.normal : 0) +
        (g.dry ? q.dry * g.dry : 0) +
        (g.wet ? q.wet * g.wet : 0)
      );
    }, 0);
  }, [quantities]);

  const reset = () => setQuantities({});

  return (
    <main
      dir={isAr ? "rtl" : "ltr"}
      lang={isAr ? "ar" : undefined}
      className="min-h-screen px-4 py-12 md:px-6 md:py-16"
      style={{
        backgroundColor: "#c6c1bb",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "760px",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#26364d] text-[#d8b98a] shadow-xl">
            <Calculator size={32} />
          </div>
          <h1 className="text-5xl font-bold text-[#26364d] md:text-6xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            {t.subtitle}
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 md:mt-10 md:flex md:flex-wrap md:justify-center">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex min-h-[56px] items-center justify-center rounded-2xl border px-2 py-2 text-center text-[12px] font-semibold leading-4 transition md:min-h-0 md:px-7 md:py-3 md:text-base ${
                activeCategory === category.id
                  ? "border-[#26364d] bg-[#26364d]/95 text-white shadow-lg"
                  : "border-[#d8cbbd] bg-white/55 text-[#26364d] backdrop-blur hover:bg-white/80"
              }`}
            >
              {categoryName(category.id, locale)}
            </button>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="mt-10 hidden overflow-hidden rounded-[30px] bg-white/90 shadow-2xl backdrop-blur md:block">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] bg-[#26364d] text-white">
            <div className="flex items-center gap-3 px-8 py-5 font-bold">
              <Shirt size={19} />
              {t.item}
            </div>
            <HeaderCell icon={<Droplets size={18} />} label={t.normalWash} />
            <HeaderCell icon={<Shirt size={18} />} label={t.hydroDry} />
            <HeaderCell icon={<Sparkles size={18} />} label={t.wetClean} />
          </div>

          {visibleItems.map((g) => (
            <div
              key={g.en}
              className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="flex items-center px-8 py-6 text-lg font-bold text-[#26364d]">
                {garmentName(g, locale)}
              </div>

              {(["normal", "dry", "wet"] as Method[]).map((m) => (
                <ServiceInput
                  key={m}
                  price={g[m]}
                  value={quantities[g.en]?.[m] || 0}
                  onChange={(value) => updateQuantity(g.en, m, value)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* MOBILE TABLE */}
        <div className="mt-8 overflow-hidden rounded-[24px] bg-white/90 shadow-xl backdrop-blur md:hidden">
          <div className="grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] bg-[#26364d] text-white">
            <div className="px-3 py-4 text-sm font-bold">{t.item}</div>
            <MobileHeader lines={t.mobile.normal} />
            <MobileHeader lines={t.mobile.dry} />
            <MobileHeader lines={t.mobile.wet} />
          </div>

          {visibleItems.map((g) => (
            <div
              key={g.en}
              className="grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="px-3 py-4 text-sm font-bold leading-5 text-[#26364d]">
                {garmentName(g, locale)}
              </div>

              {(["normal", "dry", "wet"] as Method[]).map((m) => (
                <MobileServiceInput
                  key={m}
                  price={g[m]}
                  value={quantities[g.en]?.[m] || 0}
                  onChange={(value) => updateQuantity(g.en, m, value)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 rounded-3xl bg-[#26364d]/95 p-6 text-white shadow-2xl backdrop-blur md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <p className="text-sm font-semibold text-[#d8b98a]">
              {t.estimatedTotal}
            </p>
            <h2 className="mt-2 text-5xl font-bold">
              {total.toFixed(3)} {t.currency}
            </h2>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 py-4 font-semibold text-white transition hover:bg-white/15"
          >
            <RotateCcw size={18} />
            {t.reset}
          </button>
        </div>
      </div>
    </main>
  );
}

function HeaderCell({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 border-l border-white/10 px-4 py-5 text-center font-bold">
      {icon}
      {label}
    </div>
  );
}

function MobileHeader({ lines }: { lines: readonly string[] }) {
  return (
    <div className="px-2 py-4 text-center text-xs font-bold leading-4">
      {lines[0]}
      <br />
      {lines[1]}
    </div>
  );
}

function ServiceInput({
  price,
  value,
  onChange,
}: {
  price: number | null;
  value: number;
  onChange: (value: number) => void;
}) {
  if (price === null) {
    return (
      <div className="flex items-center justify-center border-l border-[#ece7e1] py-6 text-2xl text-[#b8b1a8]">
        —
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 border-l border-[#ece7e1] py-5">
      <span className="text-sm font-semibold text-[#b9925d]">
        {price.toFixed(3)}
      </span>
      <input
        type="number"
        min="0"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="0"
        className="w-24 rounded-xl border border-[#d8cbbd] bg-[#f8f1e7] px-3 py-2 text-center font-bold text-[#26364d] outline-none transition focus:border-[#26364d] focus:bg-white"
      />
    </div>
  );
}

function MobileServiceInput({
  price,
  value,
  onChange,
}: {
  price: number | null;
  value: number;
  onChange: (value: number) => void;
}) {
  if (price === null) {
    return (
      <div className="flex items-center justify-center border-l border-[#ece7e1] py-4 text-lg text-[#b8b1a8]">
        —
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 border-l border-[#ece7e1] px-1 py-3">
      <span className="text-[11px] font-semibold text-[#b9925d]">
        {price.toFixed(3)}
      </span>
      <input
        type="number"
        min="0"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="0"
        className="w-14 rounded-lg border border-[#d8cbbd] bg-[#f8f1e7] px-1 py-2 text-center text-sm font-bold text-[#26364d] outline-none focus:border-[#26364d]"
      />
    </div>
  );
}
