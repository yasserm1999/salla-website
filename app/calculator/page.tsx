"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  Droplets,
  RotateCcw,
  Shirt,
  Sparkles,
} from "lucide-react";

type Item = {
  category: string;
  item: string;
  normal: number | null;
  dry: number | null;
  wet: number | null;
};

const items: Item[] = [
  { category: "Men's Traditional", item: "Dishdasha", normal: 0.4, dry: 0.6, wet: 0.7 },
  { category: "Men's Traditional", item: "Mussar / Shmagh", normal: 0.6, dry: 0.8, wet: 0.9 },
  { category: "Men's Traditional", item: "Wizzar", normal: 0.2, dry: 0.3, wet: 0.4 },
  { category: "Men's Traditional", item: "Bisht", normal: 2.9, dry: 3.5, wet: 3.8 },

  { category: "Ladies", item: "Abaya", normal: 0.6, dry: 0.9, wet: 1.0 },
  { category: "Ladies", item: "Blouse", normal: 0.3, dry: 0.5, wet: 0.6 },
  { category: "Ladies", item: "Dress", normal: 0.9, dry: 1.2, wet: 1.4 },
  { category: "Ladies", item: "Evening Dress", normal: null, dry: 2.0, wet: 2.2 },

  { category: "General", item: "Shirt", normal: 0.3, dry: 0.5, wet: 0.6 },
  { category: "General", item: "Trousers", normal: 0.4, dry: 0.6, wet: 0.7 },
  { category: "General", item: "Jacket", normal: null, dry: 1.2, wet: 1.4 },
  { category: "General", item: "Suit", normal: null, dry: 1.8, wet: 2.0 },

  { category: "Kids' Wear", item: "Kids Shirt", normal: 0.2, dry: 0.3, wet: 0.4 },
  { category: "Kids' Wear", item: "Kids Trousers", normal: 0.2, dry: 0.3, wet: 0.4 },
  { category: "Kids' Wear", item: "Kids Dress", normal: 0.3, dry: 0.5, wet: 0.6 },

  { category: "Bedding & Household", item: "Bedsheet", normal: 1.0, dry: null, wet: 1.3 },
  { category: "Bedding & Household", item: "Blanket", normal: 1.5, dry: 2.2, wet: 2.5 },
  { category: "Bedding & Household", item: "Curtains", normal: 1.2, dry: 1.8, wet: 2.0 },
];

const categories = [
  "Men's Traditional",
  "Ladies",
  "General",
  "Kids' Wear",
  "Bedding & Household",
];

type QuantityKey = "normal" | "dry" | "wet";

export default function CalculatorPage() {
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [quantities, setQuantities] = useState<
    Record<string, { normal: number; dry: number; wet: number }>
  >({});

  const visibleItems = items.filter((item) => item.category === activeCategory);

  const updateQuantity = (
    itemName: string,
    service: QuantityKey,
    value: number
  ) => {
    setQuantities({
      ...quantities,
      [itemName]: {
        normal: quantities[itemName]?.normal || 0,
        dry: quantities[itemName]?.dry || 0,
        wet: quantities[itemName]?.wet || 0,
        [service]: value,
      },
    });
  };

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = quantities[item.item] || { normal: 0, dry: 0, wet: 0 };

      return (
        sum +
        (item.normal ? quantity.normal * item.normal : 0) +
        (item.dry ? quantity.dry * item.dry : 0) +
        (item.wet ? quantity.wet * item.wet : 0)
      );
    }, 0);
  }, [quantities]);

  const reset = () => setQuantities({});

  return (
    <main
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
            Price Calculator
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            Select your items, add quantities, and calculate your estimated
            total in OMR.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 md:mt-10 md:flex md:flex-wrap md:justify-center">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex min-h-[56px] items-center justify-center rounded-2xl border px-2 py-2 text-center text-[12px] font-semibold leading-4 transition md:min-h-0 md:px-7 md:py-3 md:text-base ${
                activeCategory === category
                  ? "border-[#26364d] bg-[#26364d]/95 text-white shadow-lg"
                  : "border-[#d8cbbd] bg-white/55 text-[#26364d] backdrop-blur hover:bg-white/80"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-10 hidden overflow-hidden rounded-[30px] bg-white/90 shadow-2xl backdrop-blur md:block">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] bg-[#26364d] text-white">
            <div className="flex items-center gap-3 px-8 py-5 font-bold">
              <Shirt size={19} />
              Item
            </div>
            <HeaderCell icon={<Droplets size={18} />} label="Normal Wash" />
            <HeaderCell icon={<Shirt size={18} />} label="Hydro Dry Clean" />
            <HeaderCell icon={<Sparkles size={18} />} label="WET Clean" />
          </div>

          {visibleItems.map((item) => (
            <div
              key={item.item}
              className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="flex items-center px-8 py-6 text-lg font-bold text-[#26364d]">
                {item.item}
              </div>

              <ServiceInput
                price={item.normal}
                value={quantities[item.item]?.normal || 0}
                onChange={(value) => updateQuantity(item.item, "normal", value)}
              />

              <ServiceInput
                price={item.dry}
                value={quantities[item.item]?.dry || 0}
                onChange={(value) => updateQuantity(item.item, "dry", value)}
              />

              <ServiceInput
                price={item.wet}
                value={quantities[item.item]?.wet || 0}
                onChange={(value) => updateQuantity(item.item, "wet", value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-[24px] bg-white/90 shadow-xl backdrop-blur md:hidden">
          <div className="grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] bg-[#26364d] text-white">
            <div className="px-3 py-4 text-sm font-bold">Item</div>
            <div className="px-2 py-4 text-center text-xs font-bold leading-4">
              Normal
              <br />
              Wash
            </div>
            <div className="px-2 py-4 text-center text-xs font-bold leading-4">
              Hydro
              <br />
              Dry
            </div>
            <div className="px-2 py-4 text-center text-xs font-bold leading-4">
              WET
              <br />
              Clean
            </div>
          </div>

          {visibleItems.map((item) => (
            <div
              key={item.item}
              className="grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] border-b border-[#ece7e1] last:border-b-0"
            >
              <div className="px-3 py-4 text-sm font-bold leading-5 text-[#26364d]">
                {item.item}
              </div>

              <MobileServiceInput
                price={item.normal}
                value={quantities[item.item]?.normal || 0}
                onChange={(value) => updateQuantity(item.item, "normal", value)}
              />

              <MobileServiceInput
                price={item.dry}
                value={quantities[item.item]?.dry || 0}
                onChange={(value) => updateQuantity(item.item, "dry", value)}
              />

              <MobileServiceInput
                price={item.wet}
                value={quantities[item.item]?.wet || 0}
                onChange={(value) => updateQuantity(item.item, "wet", value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 rounded-3xl bg-[#26364d]/95 p-6 text-white shadow-2xl backdrop-blur md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d8b98a]">
              Estimated Total
            </p>
            <h2 className="mt-2 text-5xl font-bold">{total.toFixed(3)} OMR</h2>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 py-4 font-semibold text-white transition hover:bg-white/15"
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}

function HeaderCell({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 border-l border-white/10 px-4 py-5 text-center font-bold">
      {icon}
      {label}
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