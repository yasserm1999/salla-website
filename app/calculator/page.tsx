"use client";

import { useMemo, useState } from "react";

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
  const [activeCategory, setActiveCategory] = useState("Men's Traditional");
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

      const normalTotal = item.normal ? quantity.normal * item.normal : 0;
      const dryTotal = item.dry ? quantity.dry * item.dry : 0;
      const wetTotal = item.wet ? quantity.wet * item.wet : 0;

      return sum + normalTotal + dryTotal + wetTotal;
    }, 0);
  }, [quantities]);

  return (
    <main className="bg-[#c6c1bb] px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-[#26364d] md:text-6xl">
            Price Calculator
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            Select a category, enter quantities for each service, and get an
            estimated total. Prices are shown in OMR.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition md:px-7 md:text-base ${
                activeCategory === category
                  ? "bg-[#26364d] text-white shadow-lg"
                  : "bg-white/80 text-[#26364d] hover:bg-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-[#26364d] px-4 py-4 text-sm font-bold text-white md:px-6 md:text-lg">
            <div>Item</div>
            <div className="text-center">Normal Wash</div>
            <div className="text-center">Dry Clean</div>
            <div className="text-center">WET Clean</div>
          </div>

          {visibleItems.map((item) => (
            <div
              key={item.item}
              className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center border-b border-[#eef2f4] px-4 py-4 md:px-6"
            >
              <div className="font-semibold text-[#26364d]">{item.item}</div>

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

        <div className="mt-8 rounded-3xl bg-[#26364d] p-8 text-center text-white shadow-xl">
          <p className="text-lg text-[#9cb2bf]">Estimated Total</p>
          <h2 className="mt-2 text-5xl font-bold">{total.toFixed(3)} OMR</h2>
        </div>
      </div>
    </main>
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
    return <div className="text-center text-[#9aa5af]">—</div>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-[#546d83]">{price.toFixed(3)}</span>
      <input
        type="number"
        min="0"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="0"
        className="w-20 rounded-xl border border-[#d8e1e7] px-3 py-2 text-center outline-none focus:border-[#546d83]"
      />
    </div>
  );
}