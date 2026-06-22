"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Clock3,
  Crown,
  Droplets,
  Leaf,
  Settings,
  Shirt,
  X,
} from "lucide-react";

type Method = "normal" | "dry" | "wet";

type PriceItem = {
  item: string;
  normal: string;
  dry: string;
  wet: string;
  recommended: Method;
  reason: string;
  suitable: string;
  note?: string;
};

const data: Record<string, PriceItem[]> = {
  "الملابس الرجالية التقليدية": [
    {
      item: "دشداشة",
      normal: "0.400",
      dry: "0.600",
      wet: "0.700",
      recommended: "dry",
      reason:
        "يساعد التنظيف الجاف بالهيدروكربون على الحفاظ على الهيكل وشكل الياقة والتشطيب الأبيض الفاخر.",
      suitable: "القطن والكتان والمخاليط والدشاديش الفاخرة",
      note: "غير موصى به لبقع الطين الكثيفة جداً.",
    },
    {
      item: "مصر/شماغ",
      normal: "-",
      dry: "0.800",
      wet: "0.900",
      recommended: "dry",
      reason:
        "يحمي التنظيف الجاف بالهيدروكربون الألياف الرقيقة ويبقي الألوان نضرة.",
      suitable: "المصر والشماغ والأقمشة الرقيقة",
      note: "للبقع، يلزم الفحص أولاً.",
    },
    {
      item: "وزار",
      normal: "0.200",
      dry: "0.300",
      wet: "-",
      recommended: "normal",
      reason: "الغسيل العادي كافٍ لمعظم الملابس القطنية للاستخدام اليومي.",
      suitable: "الأقمشة القطنية العادية وملابس الاستخدام اليومي",
    },
    {
      item: "ربطة عنق",
      normal: "0.300",
      dry: "0.400",
      wet: "-",
      recommended: "dry",
      reason:
        "يحمي التنظيف الجاف بالهيدروكربون الشكل ويتجنب التشوه الناتج عن الغسيل بالماء.",
      suitable: "ربطات العنق الرسمية والزخارف الرقيقة",
    },
    {
      item: "فانلة داخلية",
      normal: "0.200",
      dry: "0.300",
      wet: "-",
      recommended: "normal",
      reason:
        "الغسيل العادي كافٍ للفانلات الداخلية اليومية والأقمشة القطنية العادية.",
      suitable: "الفانلات القطنية الداخلية اليومية",
    },
    {
      item: "بشت",
      normal: "-",
      dry: "3.500",
      wet: "3.800",
      recommended: "dry",
      reason:
        "يُوصى بالتنظيف الجاف بالهيدروكربون لحماية الهيكل والزخارف والتشطيب الرقيق.",
      suitable: "البشوت والزخارف والملابس الرسمية الفاخرة",
    },
    {
      item: "كمة عُمانية",
      normal: "-",
      dry: "0.400",
      wet: "-",
      recommended: "dry",
      reason:
        "يحمي التنظيف الجاف بالهيدروكربون هيكل الكمة وتفاصيل التطريز.",
      suitable: "الكمات العُمانية وتفاصيل التطريز",
    },
  ],

  نسائية: [
    {
      item: "عباية",
      normal: "0.600",
      dry: "0.900",
      wet: "1.000",
      recommended: "wet",
      reason:
        "يُوصى بالتنظيف الرطب للعبايات الرقيقة لأنه يمنح تشطيباً أنعم وعناية أفضل بالقماش.",
      suitable: "العبايات الرقيقة والتطريز والأقمشة الفاخرة",
    },
    {
      item: "عباية حرير",
      normal: "-",
      dry: "-",
      wet: "2.500",
      recommended: "wet",
      reason:
        "يُوصى بالتنظيف الرطب الاحترافي لأن الحرير يحتاج إلى معالجة لطيفة وتشطيب متحكم به.",
      suitable: "عبايات الحرير فقط",
    },
    {
      item: "فستان",
      normal: "-",
      dry: "1.200",
      wet: "1.400",
      recommended: "wet",
      reason:
        "التنظيف الرطب ألطف للفساتين الرقيقة ويساعد في الحفاظ على نعومة القماش.",
      suitable: "الفساتين الرقيقة والأقمشة الناعمة",
    },
  ],

  عام: [
    {
      item: "قميص",
      normal: "0.300",
      dry: "0.500",
      wet: "0.600",
      recommended: "normal",
      reason: "الغسيل العادي كافٍ للقمصان اليومية العادية.",
      suitable: "القمصان اليومية ومخاليط القطن العادية",
    },
    {
      item: "بنطلون",
      normal: "0.400",
      dry: "0.600",
      wet: "0.700",
      recommended: "normal",
      reason:
        "الغسيل العادي مناسب للبناطيل العادية ما لم يكن القماش رقيقاً أو مهيكلاً.",
      suitable: "البناطيل العادية والملابس اليومية",
    },
    {
      item: "بدلة",
      normal: "-",
      dry: "1.800",
      wet: "2.000",
      recommended: "dry",
      reason:
        "يحمي التنظيف الجاف بالهيدروكربون هيكل البدلة والبطانة والتشطيب الرسمي.",
      suitable: "البدلات والجاكيتات والملابس المهيكلة",
    },
  ],

  "ملابس الأطفال": [
    {
      item: "قميص أطفال",
      normal: "0.200",
      dry: "0.300",
      wet: "-",
      recommended: "normal",
      reason: "الغسيل العادي مناسب لمعظم ملابس الأطفال اليومية.",
      suitable: "ملابس الأطفال اليومية",
    },
    {
      item: "فستان أطفال",
      normal: "0.300",
      dry: "0.500",
      wet: "0.600",
      recommended: "normal",
      reason:
        "الغسيل العادي يكفي عادةً ما لم يكن القماش رقيقاً أو مزخرفاً.",
      suitable: "فساتين الأطفال العادية",
    },
  ],

  "المفروشات والمنزل": [
    {
      item: "ملاءة سرير",
      normal: "1.000",
      dry: "-",
      wet: "1.300",
      recommended: "normal",
      reason: "الغسيل العادي كافٍ لملاءات السرير القطنية العادية.",
      suitable: "ملاءات السرير القطنية والأقمشة المنزلية العادية",
    },
    {
      item: "بطانية",
      normal: "1.500",
      dry: "2.200",
      wet: "2.500",
      recommended: "wet",
      reason:
        "يمنح التنظيف الرطب عناية أعمق ومعالجة لطيفة للأقمشة الأثقل.",
      suitable: "البطانيات والأقمشة المنزلية الأسمك",
    },
  ],
};

const categories = Object.keys(data);

const methodLabels: Record<Method, string> = {
  normal: "الغسيل العادي",
  dry: "التنظيف الجاف بالهيدروكربون",
  wet: "التنظيف الرطب الاحترافي",
};

export default function PricesPageAr() {
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [selected, setSelected] = useState<PriceItem | null>(null);

  return (
    <main
      dir="rtl"
      lang="ar"
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
            الأسعار
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            الأسعار معروضة بالريال العُماني. تُميَّز الطرق الموصى بها لكل قطعة.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 md:mt-10 md:flex md:flex-wrap md:justify-center">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setSelected(null);
              }}
              className={`flex min-h-[56px] items-center justify-center rounded-2xl border px-2 py-2 text-center text-[12px] leading-4 font-semibold transition md:min-h-0 md:w-auto md:px-7 md:py-3 md:text-base ${
                activeCategory === category
                  ? "border-[#26364d] bg-[#26364d]/95 text-white shadow-lg"
                  : "border-[#d8cbbd] bg-white/55 text-[#26364d] backdrop-blur hover:bg-white/80"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="relative z-20 mt-10 hidden overflow-visible rounded-[30px] bg-white/90 shadow-2xl backdrop-blur md:block">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] overflow-hidden rounded-t-[30px] bg-[#26364d] text-white">
            <div className="flex items-center gap-3 px-8 py-5 font-bold">
              <Shirt size={19} />
              الصنف
            </div>

            <HeaderCell icon={<Droplets size={18} />} label="الغسيل العادي" />
            <HeaderCell icon={<Shirt size={18} />} label="التنظيف الجاف بالهيدروكربون" />
            <HeaderCell icon={<Droplets size={18} />} label="التنظيف الرطب الاحترافي" />
          </div>

          {data[activeCategory].map((row) => (
            <div
              key={row.item}
              className="relative grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="flex items-center px-8 py-6 text-lg font-bold text-[#26364d]">
                {row.item}
              </div>

              <PriceCell
                value={row.normal}
                recommended={row.recommended === "normal"}
                onClick={() =>
                  setSelected(selected?.item === row.item ? null : row)
                }
              />

              <PriceCell
                value={row.dry}
                recommended={row.recommended === "dry"}
                onClick={() =>
                  setSelected(selected?.item === row.item ? null : row)
                }
              />

              <PriceCell
                value={row.wet}
                recommended={row.recommended === "wet"}
                onClick={() =>
                  setSelected(selected?.item === row.item ? null : row)
                }
              />

              {selected?.item === row.item && (
                <RecommendationCard
                  row={row}
                  onClose={() => setSelected(null)}
                  desktop
                />
              )}
            </div>
          ))}
        </div>

        {/* MOBILE COMPACT TABLE */}
<div className="relative z-20 mt-8 overflow-hidden rounded-[24px] bg-white/90 shadow-xl backdrop-blur md:hidden">
  <div className="grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] rounded-t-[24px] bg-[#26364d] text-white">
    <div className="px-3 py-4 text-sm font-bold">الصنف</div>
    <div className="px-2 py-4 text-center text-xs font-bold leading-4">
      غسيل
      <br />
      عادي
    </div>
    <div className="px-2 py-4 text-center text-xs font-bold leading-4">
      هيدرو
      <br />
      جاف
    </div>
    <div className="px-2 py-4 text-center text-xs font-bold leading-4">
      تنظيف
      <br />
      رطب
    </div>
  </div>

  {data[activeCategory].map((row) => (
    <div
      key={row.item}
      className="grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] border-b border-[#ece7e1] last:border-b-0"
    >
      <div className="px-3 py-4 text-sm font-bold leading-5 text-[#26364d]">
        {row.item}
      </div>

      <MobileTableCell
        value={row.normal}
        recommended={row.recommended === "normal"}
        onClick={() =>
          setSelected(selected?.item === row.item ? null : row)
        }
      />

      <MobileTableCell
        value={row.dry}
        recommended={row.recommended === "dry"}
        onClick={() =>
          setSelected(selected?.item === row.item ? null : row)
        }
      />

      <MobileTableCell
        value={row.wet}
        recommended={row.recommended === "wet"}
        onClick={() =>
          setSelected(selected?.item === row.item ? null : row)
        }
      />
    </div>
  ))}
</div>

       {selected && (
  <div className="md:hidden">
    <RecommendationCard
      row={selected}
      onClose={() => setSelected(null)}
    />
  </div>
)}

        <div className="relative z-10 mt-10 grid rounded-3xl bg-[#26364d]/95 text-white shadow-2xl backdrop-blur md:grid-cols-4">
          <Feature
            icon={<Crown />}
            title="عناية متميّزة"
            text="عناية احترافية لكل قماش"
          />
          <Feature
            icon={<Settings />}
            title="تقنية متطوّرة"
            text="آلات حديثة، نتائج أفضل"
          />
          <Feature
            icon={<Leaf />}
            title="آمن على الأقمشة"
            text="لطيف على القماش، قوي على الأوساخ"
          />
          <Feature
            icon={<Clock3 />}
            title="التزام بالمواعيد"
            text="دائماً في الموعد، في كل مرة"
          />
        </div>
      </div>
    </main>
  );
}

function HeaderCell({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 border-l border-white/10 px-4 py-5 text-center font-bold">
      {icon}
      {label}
    </div>
  );
}

function PriceCell({
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
        className={`min-w-[165px] rounded-xl border px-5 py-3 text-base font-bold transition ${
          recommended
            ? "border-[#d8b98a] bg-[#f8f1e7] text-[#b9925d] shadow-sm hover:scale-105"
            : "border-transparent text-[#26364d]"
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <span>{value}</span>

          {recommended && (
            <>
              <span className="text-sm">★</span>
              <span className="text-xs font-medium">موصى به</span>
            </>
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
      <div className="flex items-center justify-center border-l border-[#ece7e1] py-4 text-lg text-[#b8b1a8]">
        —
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center border-l border-[#ece7e1] py-3">
      <button
        type="button"
        onClick={recommended ? onClick : undefined}
        className={`rounded-xl border px-2 py-2 text-sm font-bold ${
          recommended
            ? "border-[#d8b98a] bg-[#f8f1e7] text-[#b9925d]"
            : "border-transparent text-[#26364d]"
        }`}
      >
        {value}
        {recommended && <span className="ml-1">★</span>}
      </button>
    </div>
  );
}

function RecommendationCard({
  row,
  onClose,
  desktop = false,
}: {
  row: PriceItem;
  onClose: () => void;
  desktop?: boolean;
}) {
  const leftPosition =
    row.recommended === "normal"
      ? "right-[47%]"
      : row.recommended === "dry"
      ? "right-[70%]"
      : "right-[90%]";

  return (
    <div
      className={
        desktop
          ? `absolute ${leftPosition} top-[72px] z-[120] w-[355px] -translate-x-1/2`
          : "fixed left-1/2 top-[38%] z-[999] w-[88vw] max-w-[360px] -translate-x-1/2"
      }
    >
      <div className="relative rounded-[26px] bg-[#102845] p-5 text-white shadow-2xl md:p-6">
        {desktop && (
          <div className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 bg-[#102845]" />
        )}

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-white/70 transition hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-16 w-14 items-center justify-center rounded-xl bg-white/10 text-3xl md:h-20 md:w-16 md:text-4xl">
            👕
          </div>

          <div className="pr-8">
            <h3 className="text-base font-bold leading-6 md:text-lg">
              لماذا {methodLabels[row.recommended]}؟
            </h3>

            <p className="mt-1 text-xs text-white/70">
              موصى به لـ {row.item}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-[#d8b98a] px-4 py-3 text-xs font-semibold text-[#102845]">
          مناسب لـ: {row.suitable}
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-white/90">
          <div className="flex gap-3">
            <span className="text-[#d8b98a]">✦</span>
            <p>{row.reason}</p>
          </div>

          <div className="flex gap-3">
            <span className="text-[#d8b98a]">✦</span>
            <p>يحافظ على جودة القماش والتشطيب.</p>
          </div>

          <div className="flex gap-3">
            <span className="text-[#d8b98a]">✦</span>
            <p>موصى به من سلَّة لعناية أفضل بالملابس.</p>
          </div>

          {row.note && (
            <div className="border-t border-white/15 pt-3 text-white/80">
              {row.note}
            </div>
          )}
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
