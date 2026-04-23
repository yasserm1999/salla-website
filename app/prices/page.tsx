"use client";

import { useMemo, useState } from "react";

type PriceItem = {
  item: string;
  dry: string;
  laundry: string;
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
      { item: "Dishdasha", dry: "0.600 OMR", laundry: "0.400 OMR", wet: "0.700 OMR" },
      { item: "Mussar / Shmagh", dry: "0.800 OMR", laundry: "0.600 OMR", wet: "0.900 OMR" },
      { item: "Wizzar", dry: "0.300 OMR", laundry: "0.200 OMR", wet: "0.400 OMR" },
      { item: "Tie", dry: "0.400 OMR", laundry: "0.300 OMR", wet: "0.500 OMR" },
      { item: "Under Shirt (Fanila)", dry: "0.300 OMR", laundry: "0.200 OMR", wet: "0.400 OMR" },
      { item: "Bisht", dry: "3.500 OMR", laundry: "2.900 OMR", wet: "3.800 OMR" },
      { item: "Cap (Omani)", dry: "0.400 OMR", laundry: "0.300 OMR", wet: "0.500 OMR" },
      { item: "Underwear (Male)", dry: "0.200 OMR", laundry: "0.100 OMR", wet: "0.300 OMR" },
      { item: "Coverall", dry: "1.300 OMR", laundry: "1.000 OMR", wet: "1.500 OMR" },
    ],
  },
  {
    key: "ladies",
    label: "Ladies",
    items: [
      { item: "Abaya", dry: "0.900 OMR", laundry: "0.600 OMR", wet: "1.000 OMR" },
      { item: "Blouse", dry: "0.500 OMR", laundry: "0.300 OMR", wet: "0.600 OMR" },
      { item: "Dress", dry: "1.200 OMR", laundry: "0.900 OMR", wet: "1.400 OMR" },
      { item: "Evening Dress", dry: "2.000 OMR", laundry: "—", wet: "2.200 OMR" },
      { item: "Skirt", dry: "0.600 OMR", laundry: "0.400 OMR", wet: "0.700 OMR" },
      { item: "Scarf", dry: "0.300 OMR", laundry: "0.200 OMR", wet: "0.400 OMR" },
    ],
  },
  {
    key: "general",
    label: "General",
    items: [
      { item: "Shirt", dry: "0.500 OMR", laundry: "0.300 OMR", wet: "0.600 OMR" },
      { item: "Trousers", dry: "0.600 OMR", laundry: "0.400 OMR", wet: "0.700 OMR" },
      { item: "Jacket", dry: "1.200 OMR", laundry: "—", wet: "1.400 OMR" },
      { item: "Suit (2 pcs)", dry: "1.800 OMR", laundry: "—", wet: "2.000 OMR" },
      { item: "Coat", dry: "1.500 OMR", laundry: "—", wet: "1.700 OMR" },
      { item: "T-Shirt", dry: "0.400 OMR", laundry: "0.250 OMR", wet: "0.500 OMR" },
    ],
  },
  {
    key: "kids",
    label: "Kids' Wear",
    items: [
      { item: "Kids Shirt", dry: "0.300 OMR", laundry: "0.200 OMR", wet: "0.400 OMR" },
      { item: "Kids Trousers", dry: "0.300 OMR", laundry: "0.200 OMR", wet: "0.400 OMR" },
      { item: "Kids Dress", dry: "0.500 OMR", laundry: "0.300 OMR", wet: "0.600 OMR" },
      { item: "Kids Jacket", dry: "0.700 OMR", laundry: "—", wet: "0.900 OMR" },
    ],
  },
  {
    key: "bedding",
    label: "Bedding & Household",
    items: [
      { item: "Bedsheet", dry: "—", laundry: "1.000 OMR", wet: "1.300 OMR" },
      { item: "Blanket", dry: "2.200 OMR", laundry: "1.500 OMR", wet: "2.500 OMR" },
      { item: "Curtains", dry: "1.800 OMR", laundry: "1.200 OMR", wet: "2.000 OMR" },
      { item: "Pillow Cover", dry: "—", laundry: "0.300 OMR", wet: "0.400 OMR" },
      { item: "Duvet Cover", dry: "—", laundry: "1.200 OMR", wet: "1.500 OMR" },
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
    <main className="bg-[#f5f3f0] px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-[#26364d] md:text-6xl">Prices</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            Clear pricing for every category. Select a service group below to view the relevant items and rates.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-3 md:gap-4">
          {categories.map((category) => {
            const isActive = activeCategory === category.key;

            return (
              <button
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition md:px-8 md:py-4 md:text-xl ${
                  isActive
                    ? "bg-[#9cb2bf] text-white shadow-[0_10px_24px_rgba(84,109,131,0.22)]"
                    : "bg-[#e6ecef] text-[#546d83] hover:bg-[#d7e1e6]"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#d9dde2] bg-white shadow-[0_14px_40px_rgba(38,54,77,0.08)]">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-[#3a4654] px-4 py-5 text-sm font-bold text-white md:px-8 md:py-7 md:text-2xl">
            <div>Item</div>
            <div className="text-center">Dry Clean / Special Care</div>
            <div className="text-center">Laundry</div>
            <div className="text-center">Wet Clean</div>
          </div>

          <div className="divide-y divide-[#e7eaee]">
            {activeData.items.map((row) => (
              <div
                key={row.item}
                className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center px-4 py-5 text-sm text-[#4b5765] md:px-8 md:py-7 md:text-2xl"
              >
                <div className="font-medium text-[#3e4956]">{row.item}</div>
                <div className="text-center">{row.dry}</div>
                <div className="text-center">{row.laundry}</div>
                <div className="text-center">{row.wet}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-[#546d83] md:text-base">
          Rates can be adjusted later based on garment type, fabric sensitivity, and treatment requirements.
        </div>
      </div>
    </main>
  );
}