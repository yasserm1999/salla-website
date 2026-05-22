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
  "Men's Traditional": [
    {
      item: "Dishdasha",
      normal: "0.400",
      dry: "0.600",
      wet: "0.700",
      recommended: "dry",
      reason:
        "Hydro Dry Clean helps preserve structure, collar shape, and premium white finishing.",
      suitable: "Cotton, linen, blends, and premium dishdashas",
      note: "Not recommended for very heavy mud stains.",
    },
    {
      item: "Mussar / Shmagh",
      normal: "-",
      dry: "0.800",
      wet: "0.900",
      recommended: "dry",
      reason:
        "Hydro Dry Clean protects delicate fibers and keeps colors looking fresh.",
      suitable: "Mussar, shmagh, and delicate fabrics",
      note: "For stains, inspection is required first.",
    },
    {
      item: "Wizzar",
      normal: "0.200",
      dry: "0.300",
      wet: "-",
      recommended: "normal",
      reason: "Normal Wash is sufficient for most daily-use cotton garments.",
      suitable: "Regular cotton fabrics and daily-use garments",
    },
    {
      item: "Tie",
      normal: "0.300",
      dry: "0.400",
      wet: "-",
      recommended: "dry",
      reason:
        "Hydro Dry Clean protects the shape and avoids distortion from water washing.",
      suitable: "Formal ties and delicate trims",
    },
    {
      item: "Under Shirt",
      normal: "0.200",
      dry: "0.300",
      wet: "-",
      recommended: "normal",
      reason:
        "Normal Wash is enough for daily undershirts and regular cotton fabrics.",
      suitable: "Daily cotton undershirts",
    },
    {
      item: "Bisht",
      normal: "-",
      dry: "3.500",
      wet: "3.800",
      recommended: "dry",
      reason:
        "Hydro Dry Clean is recommended to protect structure, trims, and delicate finishing.",
      suitable: "Bishts, trims, and premium formal garments",
    },
    {
      item: "Omani Cap",
      normal: "-",
      dry: "0.400",
      wet: "-",
      recommended: "dry",
      reason:
        "Hydro Dry Clean protects the cap structure and embroidered details.",
      suitable: "Omani caps and embroidered details",
    },
  ],

  Ladies: [
    {
      item: "Abaya",
      normal: "0.600",
      dry: "0.900",
      wet: "1.000",
      recommended: "wet",
      reason:
        "WET Cleaning is recommended for delicate abayas because it gives softer finishing and better fabric care.",
      suitable: "Delicate abayas, embroidery, and premium fabrics",
    },
    {
      item: "Silk Abaya",
      normal: "-",
      dry: "-",
      wet: "2.500",
      recommended: "wet",
      reason:
        "Professional WET Cleaning is recommended because silk needs gentle handling and controlled finishing.",
      suitable: "Silk abayas only",
    },
    {
      item: "Dress",
      normal: "-",
      dry: "1.200",
      wet: "1.400",
      recommended: "wet",
      reason:
        "WET Cleaning is gentler for delicate dresses and helps keep the fabric soft.",
      suitable: "Delicate dresses and soft fabrics",
    },
  ],

  General: [
    {
      item: "Shirt",
      normal: "0.300",
      dry: "0.500",
      wet: "0.600",
      recommended: "normal",
      reason: "Normal Wash is sufficient for standard daily shirts.",
      suitable: "Daily shirts and regular cotton blends",
    },
    {
      item: "Trousers",
      normal: "0.400",
      dry: "0.600",
      wet: "0.700",
      recommended: "normal",
      reason:
        "Normal Wash is suitable for regular trousers unless fabric is delicate or structured.",
      suitable: "Regular trousers and daily wear",
    },
    {
      item: "Suit",
      normal: "-",
      dry: "1.800",
      wet: "2.000",
      recommended: "dry",
      reason:
        "Hydro Dry Clean protects suit structure, lining, and formal finishing.",
      suitable: "Suits, jackets, and structured garments",
    },
  ],

  "Kids' Wear": [
    {
      item: "Kids Shirt",
      normal: "0.200",
      dry: "0.300",
      wet: "-",
      recommended: "normal",
      reason: "Normal Wash is suitable for most kids' daily garments.",
      suitable: "Daily kidswear",
    },
    {
      item: "Kids Dress",
      normal: "0.300",
      dry: "0.500",
      wet: "0.600",
      recommended: "normal",
      reason:
        "Normal Wash is usually enough unless the fabric is delicate or decorated.",
      suitable: "Regular kids dresses",
    },
  ],

  "Bedding & Household": [
    {
      item: "Bedsheet",
      normal: "1.000",
      dry: "-",
      wet: "1.300",
      recommended: "normal",
      reason: "Normal Wash is sufficient for regular cotton bedsheets.",
      suitable: "Cotton bedsheets and regular household fabrics",
    },
    {
      item: "Blanket",
      normal: "1.500",
      dry: "2.200",
      wet: "2.500",
      recommended: "wet",
      reason:
        "WET Cleaning gives deeper care and gentle handling for heavier fabrics.",
      suitable: "Blankets and thicker household fabrics",
    },
  ],
};

const categories = Object.keys(data);

const methodLabels: Record<Method, string> = {
  normal: "Normal Wash",
  dry: "Hydro Dry Clean",
  wet: "WET Clean",
};

export default function PricesPage() {
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [selected, setSelected] = useState<PriceItem | null>(null);

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
          <h1 className="text-5xl font-bold text-[#26364d] md:text-6xl">
            Prices
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            Prices are shown in OMR. Recommended methods are highlighted per
            garment.
          </p>
        </div>

        <div className="mt-8 flex gap-3 overflow-x-auto pb-2 md:mt-10 md:flex-wrap md:justify-center md:overflow-visible">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setSelected(null);
              }}
              className={`shrink-0 rounded-2xl border px-5 py-3 text-sm font-semibold transition md:px-7 md:text-base ${
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
              Item
            </div>

            <HeaderCell icon={<Droplets size={18} />} label="Normal Wash" />
            <HeaderCell icon={<Shirt size={18} />} label="Hydro Dry Clean" />
            <HeaderCell icon={<Droplets size={18} />} label="WET Clean" />
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
        <div className="relative z-20 mt-8 overflow-x-auto rounded-[24px] bg-white/90 shadow-xl backdrop-blur md:hidden">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] bg-[#26364d] text-white">
              <div className="px-4 py-4 text-sm font-bold">Item</div>
              <div className="px-3 py-4 text-center text-sm font-bold">
                Normal
              </div>
              <div className="px-3 py-4 text-center text-sm font-bold">
                Dry
              </div>
              <div className="px-3 py-4 text-center text-sm font-bold">
                WET
              </div>
            </div>

            {data[activeCategory].map((row) => (
              <div
                key={row.item}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-[#ece7e1] last:border-b-0"
              >
                <div className="px-4 py-4 text-sm font-bold text-[#26364d]">
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
        </div>

        {selected && (
          <RecommendationCard
            row={selected}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="relative z-10 mt-10 grid rounded-3xl bg-[#26364d]/95 text-white shadow-2xl backdrop-blur md:grid-cols-4">
          <Feature
            icon={<Crown />}
            title="Premium Care"
            text="Expert care for every fabric"
          />
          <Feature
            icon={<Settings />}
            title="Advanced Technology"
            text="Modern machines, better results"
          />
          <Feature
            icon={<Leaf />}
            title="Fabric Safe"
            text="Gentle on fabric, tough on dirt"
          />
          <Feature
            icon={<Clock3 />}
            title="On-Time Promise"
            text="Always on time, every time"
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
              <span className="text-xs font-medium">Recommended</span>
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
      <div className="flex items-center justify-center border-l border-[#ece7e1] py-4 text-[#b8b1a8]">
        —
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center border-l border-[#ece7e1] py-3">
      <button
        type="button"
        onClick={recommended ? onClick : undefined}
        className={`rounded-xl border px-3 py-2 text-sm font-bold ${
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
      ? "left-[47%]"
      : row.recommended === "dry"
      ? "left-[70%]"
      : "left-[90%]";

  return (
    <div
      className={
        desktop
          ? `absolute ${leftPosition} top-[72px] z-[120] w-[355px] -translate-x-1/2`
          : "fixed left-1/2 top-1/2 z-[999] w-[88vw] max-w-[360px] -translate-x-1/2 -translate-y-1/2"
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
              Why {methodLabels[row.recommended]}?
            </h3>

            <p className="mt-1 text-xs text-white/70">
              Recommended for {row.item}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-[#d8b98a] px-4 py-3 text-xs font-semibold text-[#102845]">
          Suitable for: {row.suitable}
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-white/90">
          <div className="flex gap-3">
            <span className="text-[#d8b98a]">✦</span>
            <p>{row.reason}</p>
          </div>

          <div className="flex gap-3">
            <span className="text-[#d8b98a]">✦</span>
            <p>Preserves fabric quality and finishing.</p>
          </div>

          <div className="flex gap-3">
            <span className="text-[#d8b98a]">✦</span>
            <p>Recommended by Salla for better garment care.</p>
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