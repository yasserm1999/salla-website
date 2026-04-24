"use client";

import { useMemo, useState } from "react";

type PriceItem = {
  item: string;
  normal: string;
  dry: string;
  wet: string;
};

type Category = {
  key: string;
  label: string;
  items: PriceItem[];
};

const categories: Category[] = [
  {
    key: "mens",
    label: "Men's Traditional",
    items: [
      { item: "Dishdasha", normal: "0.400", dry: "0.600", wet: "0.700" },
      { item: "Mussar / Shmagh", normal: "0.600", dry: "0.800", wet: "0.900" },
      { item: "Wizzar", normal: "0.200", dry: "0.300", wet: "0.400" },
      { item: "Tie", normal: "0.300", dry: "0.400", wet: "0.500" },
      { item: "Under Shirt", normal: "0.200", dry: "0.300", wet: "0.400" },
      { item: "Bisht", normal: "2.900", dry: "3.500", wet: "3.800" },
      { item: "Omani Cap", normal: "0.300", dry: "0.400", wet: "0.500" },
    ],
  },
  {
    key: "ladies",
    label: "Ladies",
    items: [
      { item: "Abaya", normal: "0.600", dry: "0.900", wet: "1.000" },
      { item: "Blouse", normal: "0.300", dry: "0.500", wet: "0.600" },
      { item: "Dress", normal: "0.900", dry: "1.200", wet: "1.400" },
      { item: "Evening Dress", normal: "—", dry: "2.000", wet: "2.200" },
      { item: "Skirt", normal: "0.400", dry: "0.600", wet: "0.700" },
    ],
  },
  {
    key: "general",
    label: "General",
    items: [
      { item: "Shirt", normal: "0.300", dry: "0.500", wet: "0.600" },
      { item: "Trousers", normal: "0.400", dry: "0.600", wet: "0.700" },
      { item: "Jacket", normal: "—", dry: "1.200", wet: "1.400" },
      { item: "Suit", normal: "—", dry: "1.800", wet: "2.000" },
      { item: "Coat", normal: "—", dry: "1.500", wet: "1.700" },
    ],
  },
  {
    key: "kids",
    label: "Kids' Wear",
    items: [
      { item: "Kids Shirt", normal: "0.200", dry: "0.300", wet: "0.400" },
      { item: "Kids Trousers", normal: "0.200", dry: "0.300", wet: "0.400" },
      { item: "Kids Dress", normal: "0.300", dry: "0.500", wet: "0.600" },
      { item: "Kids Jacket", normal: "—", dry: "0.700", wet: "0.900" },
    ],
  },
  {
    key: "bedding",
    label: "Bedding & Household",
    items: [
      { item: "Bedsheet", normal: "1.000", dry: "—", wet: "1.300" },
      { item: "Blanket", normal: "1.500", dry: "2.200", wet: "2.500" },
      { item: "Curtains", normal: "1.200", dry: "1.800", wet: "2.000" },
      { item: "Pillow Cover", normal: "0.300", dry: "—", wet: "0.400" },
    ],
  },
];

export default function PricesPage() {
  const [activeCategory, setActiveCategory] = useState("mens");

  const activeData = useMemo(
    () => categories.find((category) => category.key === activeCategory) ?? categories[0],
    [activeCategory]
  );

  return (
    <main className="bg-[#c6c1bb] px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-[#26364d] md:text-6xl">Prices</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#26364d] md:text-lg">
            Prices are shown in OMR. Select a category to view the relevant price table.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-3 md:gap-4">
          {categories.map((category) => {
            const isActive = activeCategory === category.key;

            return (
              <button
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition md:px-8 md:py-4 md:text-lg ${
                  isActive
                    ? "bg-[#26364d] text-white shadow-lg"
                    : "bg-white/80 text-[#26364d] hover:bg-white"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/40 bg-white shadow-xl">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-[#26364d] px-4 py-5 text-sm font-bold text-white md:px-8 md:text-xl">
            <div>Item</div>
            <div className="text-center">Normal Wash</div>
            <div className="text-center">Dry Clean</div>
            <div className="text-center">WET Clean</div>
          </div>

          <div className="divide-y divide-[#eef2f4]">
            {activeData.items.map((row) => (
              <div
                key={row.item}
                className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center px-4 py-5 text-sm text-[#4b5765] md:px-8 md:text-xl"
              >
                <div className="font-semibold text-[#26364d]">{row.item}</div>
                <div className="border-l border-[#eef2f4] text-center">{row.normal}</div>
                <div className="border-l border-[#eef2f4] text-center">{row.dry}</div>
                <div className="border-l border-[#eef2f4] text-center font-semibold text-[#26364d]">
                  {row.wet}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}