"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Clock3, Crown, Droplets, Leaf, Settings, Shirt, Sparkles, X } from "lucide-react";
import {
  CATEGORIES,
  GARMENTS,
  METHOD_LABELS,
  RECO,
  categoryName,
  garmentName,
  priceLabel,
  type CatId,
  type Garment,
  type Locale,
  type Method,
} from "../data/pricing";

const METHODS: Method[] = ["normal", "dry", "wet", "press"];

const UI = {
  en: {
    title: "Prices",
    subtitle:
      "Prices are shown in OMR. Recommended methods are highlighted per garment.",
    item: "Item",
    normalWash: "Normal Wash",
    hydroDry: "Hydro Dry Clean",
    wetClean: "WET Clean",
    pressing: "Pressing",
    mobile: {
      normal: ["Normal", "Wash"],
      dry: ["Hydro", "Dry"],
      wet: ["WET", "Clean"],
      press: ["Press", "Iron"],
    },
    recommended: "Recommended",
    why: "Why",
    recommendedFor: "Recommended for",
    suitableFor: "Suitable for:",
    bullet2: "Preserves fabric quality and finishing.",
    bullet3: "Recommended by Salla for better garment care.",
    features: [
      { title: "Premium Care", text: "Expert care for every fabric" },
      { title: "Advanced Technology", text: "Modern machines, better results" },
      { title: "Fabric Safe", text: "Gentle on fabric, tough on dirt" },
      { title: "On-Time Promise", text: "Always on time, every time" },
    ],
  },
  ar: {
    title: "الأسعار",
    subtitle:
      "الأسعار معروضة بالريال العُماني. تُميَّز الطرق الموصى بها لكل قطعة.",
    item: "الصنف",
    normalWash: "الغسيل العادي",
    hydroDry: "التنظيف الجاف بالهيدروكربون",
    wetClean: "التنظيف الرطب الاحترافي",
    pressing: "الكي",
    mobile: {
      normal: ["غسيل", "عادي"],
      dry: ["هيدرو", "جاف"],
      wet: ["تنظيف", "رطب"],
      press: ["كي", "فقط"],
    },
    recommended: "موصى به",
    why: "لماذا",
    recommendedFor: "موصى به لـ",
    suitableFor: "مناسب لـ:",
    bullet2: "يحافظ على جودة القماش والتشطيب.",
    bullet3: "موصى به من سلَّة لعناية أفضل بالملابس.",
    features: [
      { title: "عناية متميّزة", text: "عناية احترافية بكل قماش" },
      { title: "تقنية متطوّرة", text: "آلات حديثة، نتائج أفضل" },
      { title: "آمن على الأقمشة", text: "لطيف على القماش، قويّ على الأوساخ" },
      { title: "التزام بالمواعيد", text: "دائماً في الوقت المحدّد" },
    ],
  },
} as const;

export default function PricesView({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = UI[locale];

  const [activeCategory, setActiveCategory] = useState<CatId>(CATEGORIES[0].id);
  const [selected, setSelected] = useState<Garment | null>(null);

  const rows = GARMENTS.filter((g) => g.cat === activeCategory);

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
              onClick={() => {
                setActiveCategory(category.id);
                setSelected(null);
              }}
              className={`flex min-h-[56px] items-center justify-center rounded-2xl border px-2 py-2 text-center text-[12px] leading-4 font-semibold transition md:min-h-0 md:w-auto md:px-7 md:py-3 md:text-base ${
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
        <div className="relative z-20 mt-10 hidden overflow-visible rounded-[30px] bg-white/90 shadow-2xl backdrop-blur md:block">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] overflow-hidden rounded-t-[30px] bg-[#26364d] text-white">
            <div className="flex items-center gap-3 px-6 py-5 font-bold">
              <Shirt size={19} />
              {t.item}
            </div>
            <HeaderCell icon={<Droplets size={18} />} label={t.normalWash} />
            <HeaderCell icon={<Shirt size={18} />} label={t.hydroDry} />
            <HeaderCell icon={<Droplets size={18} />} label={t.wetClean} />
            <HeaderCell icon={<Sparkles size={18} />} label={t.pressing} />
          </div>

          {rows.map((row) => (
            <div
              key={row.en}
              className="relative grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="flex items-center px-6 py-6 text-lg font-bold text-[#26364d]">
                {garmentName(row, locale)}
              </div>

              {METHODS.map((m) => (
                <PriceCell
                  key={m}
                  value={priceLabel(row[m])}
                  recommended={row.recommended === m}
                  label={t.recommended}
                  onClick={() =>
                    setSelected(selected?.en === row.en ? null : row)
                  }
                />
              ))}

              {selected?.en === row.en && (
                <RecommendationCard
                  row={row}
                  locale={locale}
                  onClose={() => setSelected(null)}
                  desktop
                />
              )}
            </div>
          ))}
        </div>

        {/* MOBILE COMPACT TABLE */}
        <div className="relative z-20 mt-8 overflow-hidden rounded-[24px] bg-white/90 shadow-xl backdrop-blur md:hidden">
          <div className="grid grid-cols-[1.25fr_0.9fr_0.9fr_0.9fr_0.9fr] rounded-t-[24px] bg-[#26364d] text-white">
            <div className="px-2 py-4 text-sm font-bold">{t.item}</div>
            <MobileHeader lines={t.mobile.normal} />
            <MobileHeader lines={t.mobile.dry} />
            <MobileHeader lines={t.mobile.wet} />
            <MobileHeader lines={t.mobile.press} />
          </div>

          {rows.map((row) => (
            <div
              key={row.en}
              className="grid grid-cols-[1.25fr_0.9fr_0.9fr_0.9fr_0.9fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="px-2 py-4 text-xs font-bold leading-4 text-[#26364d]">
                {garmentName(row, locale)}
              </div>

              {METHODS.map((m) => (
                <MobileTableCell
                  key={m}
                  value={priceLabel(row[m])}
                  recommended={row.recommended === m}
                  onClick={() =>
                    setSelected(selected?.en === row.en ? null : row)
                  }
                />
              ))}
            </div>
          ))}
        </div>

        {selected && (
          <div className="md:hidden">
            <RecommendationCard
              row={selected}
              locale={locale}
              onClose={() => setSelected(null)}
            />
          </div>
        )}

        <div className="relative z-10 mt-10 grid rounded-3xl bg-[#26364d]/95 text-white shadow-2xl backdrop-blur md:grid-cols-4">
          <Feature icon={<Crown />} {...t.features[0]} />
          <Feature icon={<Settings />} {...t.features[1]} />
          <Feature icon={<Leaf />} {...t.features[2]} />
          <Feature icon={<Clock3 />} {...t.features[3]} />
        </div>
      </div>
    </main>
  );
}

function HeaderCell({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 border-l border-white/10 px-3 py-5 text-center text-sm font-bold">
      {icon}
      {label}
    </div>
  );
}

function MobileHeader({ lines }: { lines: readonly string[] }) {
  return (
    <div className="px-1 py-4 text-center text-[11px] font-bold leading-4">
      {lines[0]}
      <br />
      {lines[1]}
    </div>
  );
}

function PriceCell({
  value,
  recommended,
  label,
  onClick,
}: {
  value: string;
  recommended: boolean;
  label: string;
  onClick: () => void;
}) {
  if (value === "-") {
    return (
      <div className="flex items-center justify-center border-l border-[#ece7e1] py-6 text-2xl text-[#b8b1a8]">
        —
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center border-l border-[#ece7e1] py-5">
      <button
        type="button"
        onClick={recommended ? onClick : undefined}
        className={`rounded-xl border px-3 py-3 text-base font-bold transition ${
          recommended
            ? "border-[#d8b98a] bg-[#f8f1e7] text-[#b9925d] shadow-sm hover:scale-105"
            : "border-transparent text-[#26364d]"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1">
          <span>{value}</span>
          {recommended && (
            <span className="flex items-center gap-1 text-[10px] font-medium">
              <span>★</span>
              {label}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

function MobileTableCell({
  value,
  recommended,
  onClick,
}: {
  value: string;
  recommended: boolean;
  onClick: () => void;
}) {
  if (value === "-") {
    return (
      <div className="flex items-center justify-center border-l border-[#ece7e1] py-4 text-base text-[#b8b1a8]">
        —
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center border-l border-[#ece7e1] py-3">
      <button
        type="button"
        onClick={recommended ? onClick : undefined}
        className={`rounded-lg border px-1 py-2 text-xs font-bold ${
          recommended
            ? "border-[#d8b98a] bg-[#f8f1e7] text-[#b9925d]"
            : "border-transparent text-[#26364d]"
        }`}
      >
        {value}
        {recommended && <span className="ml-0.5">★</span>}
      </button>
    </div>
  );
}

function RecommendationCard({
  row,
  locale,
  onClose,
  desktop = false,
}: {
  row: Garment;
  locale: Locale;
  onClose: () => void;
  desktop?: boolean;
}) {
  const isAr = locale === "ar";
  const t = UI[locale];
  const copy = RECO[locale][row.recommended];
  const side = isAr ? "right" : "left";

  // Anchor the desktop popover under the recommended column (5-column grid).
  const offset =
    row.recommended === "normal"
      ? "35%"
      : row.recommended === "dry"
      ? "54%"
      : "72%";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={
        desktop
          ? "absolute top-[80px] z-[120] w-[355px] -translate-x-1/2"
          : "fixed left-1/2 top-[38%] z-[999] w-[88vw] max-w-[360px] -translate-x-1/2"
      }
      style={desktop ? { [side]: offset } : undefined}
    >
      <div className="relative rounded-[26px] bg-[#102845] p-5 text-white shadow-2xl md:p-6">
        {desktop && (
          <div className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 bg-[#102845]" />
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={isAr ? "إغلاق" : "Close"}
          className={`absolute top-5 ${isAr ? "left-5" : "right-5"} text-white/70 transition hover:text-white`}
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-16 w-14 items-center justify-center rounded-xl bg-white/10 text-3xl md:h-20 md:w-16 md:text-4xl">
            👕
          </div>

          <div className={isAr ? "pl-8" : "pr-8"}>
            <h3 className="text-base font-bold leading-6 md:text-lg">
              {t.why} {METHOD_LABELS[locale][row.recommended]}
              {isAr ? "؟" : "?"}
            </h3>
            <p className="mt-1 text-xs text-white/70">
              {t.recommendedFor} {garmentName(row, locale)}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-[#d8b98a] px-4 py-3 text-xs font-semibold text-[#102845]">
          {t.suitableFor} {copy.suitable}
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-white/90">
          {[copy.reason, t.bullet2, t.bullet3].map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-[#d8b98a]">✦</span>
              <p>{line}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 border-white/10 px-6 py-6 md:border-r md:px-8 md:py-7 last:border-r-0">
      <div className="text-[#d8b98a]">{icon}</div>
      <div>
        <h3 className="text-base font-bold md:text-lg">{title}</h3>
        <p className="mt-1 text-sm text-white/80">{text}</p>
      </div>
    </div>
  );
}
