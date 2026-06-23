// Single source of truth for garment pricing, derived from the "Final Prices"
// sheet. Both the Prices page and the Calculator (English + Arabic) read from
// this file so the two never drift apart.

export type Method = "normal" | "dry" | "wet";
export type CatId = "traditional" | "ladies" | "everyday" | "formal" | "home";
export type Locale = "en" | "ar";

export type Garment = {
  cat: CatId;
  en: string;
  ar: string;
  // Price in OMR, or null when the method is not offered for this item.
  normal: number | null;
  dry: number | null;
  wet: number | null;
  recommended: Method;
};

export const CATEGORIES: { id: CatId; en: string; ar: string }[] = [
  { id: "traditional", en: "Traditional Wear", ar: "الملابس التقليدية" },
  { id: "ladies", en: "Ladies", ar: "نسائية" },
  { id: "everyday", en: "Everyday Wear", ar: "الملابس اليومية" },
  { id: "formal", en: "Formal & Outerwear", ar: "الرسمية والمعاطف" },
  { id: "home", en: "Home & Other", ar: "المنزل وأخرى" },
];

export const METHOD_LABELS: Record<Locale, Record<Method, string>> = {
  en: { normal: "Normal Wash", dry: "Hydro Dry Clean", wet: "WET Clean" },
  ar: {
    normal: "الغسيل العادي",
    dry: "التنظيف الجاف بالهيدروكربون",
    wet: "التنظيف الرطب الاحترافي",
  },
};

// Auto-generated "why this method" copy, keyed by the recommended method.
export const RECO: Record<Locale, Record<Method, { reason: string; suitable: string }>> = {
  en: {
    normal: {
      reason: "Normal Wash is suitable for everyday garments and regular fabrics.",
      suitable: "Daily-use and regular fabrics",
    },
    dry: {
      reason: "Hydro Dry Clean protects structure, trims, and delicate finishing.",
      suitable: "Structured, formal, and delicate garments",
    },
    wet: {
      reason: "WET Cleaning gives gentle, controlled care that is softer on delicate fabrics.",
      suitable: "Delicate fabrics and premium garments",
    },
  },
  ar: {
    normal: {
      reason: "الغسيل العادي مناسب للملابس اليومية والأقمشة العادية.",
      suitable: "الاستخدام اليومي والأقمشة العادية",
    },
    dry: {
      reason: "التنظيف الجاف بالهيدروكربون يحافظ على البنية والتفاصيل والتشطيب الدقيق.",
      suitable: "الملابس المهيكلة والرسمية والرقيقة",
    },
    wet: {
      reason: "التنظيف الرطب يوفّر عناية لطيفة ومضبوطة وألطف على الأقمشة الرقيقة.",
      suitable: "الأقمشة الرقيقة والملابس الفاخرة",
    },
  },
};

export const GARMENTS: Garment[] = [
  // ── Traditional Wear ──
  { cat: "traditional", en: "Dishdasha", ar: "دشداشة", normal: 0.4, dry: 0.6, wet: 0.7, recommended: "normal" },
  { cat: "traditional", en: "Musar", ar: "مصر", normal: null, dry: 0.6, wet: 0.7, recommended: "wet" },
  { cat: "traditional", en: "Kuma", ar: "كمة", normal: null, dry: 0.4, wet: 0.5, recommended: "wet" },
  { cat: "traditional", en: "Wizar", ar: "وزار", normal: 0.2, dry: 0.3, wet: 0.4, recommended: "normal" },
  { cat: "traditional", en: "Besht", ar: "بشت", normal: null, dry: 3, wet: null, recommended: "dry" },
  { cat: "traditional", en: "Traditional Omani Clothes", ar: "ملابس عمانية تقليدية", normal: null, dry: 2.9, wet: 3.4, recommended: "dry" },
  { cat: "traditional", en: "Gutra", ar: "غترة", normal: 0.3, dry: null, wet: null, recommended: "normal" },

  // ── Ladies ──
  { cat: "ladies", en: "Abaya", ar: "عباية", normal: 1, dry: 1.25, wet: 1.5, recommended: "wet" },
  { cat: "ladies", en: "Shella", ar: "شيلة", normal: 0.3, dry: 0.4, wet: 0.5, recommended: "normal" },
  { cat: "ladies", en: "Blouse", ar: "بلوزة", normal: 0.4, dry: 0.6, wet: 0.7, recommended: "wet" },
  { cat: "ladies", en: "Dress", ar: "فستان", normal: 2, dry: 2.5, wet: 3, recommended: "wet" },
  { cat: "ladies", en: "Wedding Dress", ar: "فستان زفاف", normal: null, dry: 20.8, wet: 25, recommended: "dry" },
  { cat: "ladies", en: "Skirt", ar: "تنورة", normal: 0.5, dry: 0.8, wet: 1, recommended: "dry" },
  { cat: "ladies", en: "Party Dress", ar: "فستان سهرة", normal: null, dry: 4, wet: 4.9, recommended: "dry" },
  { cat: "ladies", en: "Night Gown", ar: "قميص نوم", normal: null, dry: 1, wet: 1.2, recommended: "wet" },
  { cat: "ladies", en: "Saree", ar: "ساري", normal: null, dry: 2, wet: 2.4, recommended: "wet" },
  { cat: "ladies", en: "Bra", ar: "حمالة صدر", normal: 0.3, dry: 0.5, wet: 0.6, recommended: "normal" },
  { cat: "ladies", en: "Top", ar: "توب", normal: 0.3, dry: null, wet: null, recommended: "normal" },

  // ── Everyday Wear ──
  { cat: "everyday", en: "Undershirt", ar: "فانلة داخلية", normal: 0.2, dry: 0.3, wet: 0.35, recommended: "normal" },
  { cat: "everyday", en: "Uniform (Set)", ar: "زيّ موحّد (طقم)", normal: 0.6, dry: 0.8, wet: 1, recommended: "normal" },
  { cat: "everyday", en: "Shirt", ar: "قميص", normal: 0.4, dry: 0.6, wet: 0.7, recommended: "normal" },
  { cat: "everyday", en: "Pajamas", ar: "بيجاما", normal: 0.4, dry: 0.6, wet: 0.8, recommended: "normal" },
  { cat: "everyday", en: "Short", ar: "شورت", normal: 0.25, dry: 0.35, wet: 0.45, recommended: "normal" },
  { cat: "everyday", en: "Underwear", ar: "ملابس داخلية", normal: 0.2, dry: 0.25, wet: 0.3, recommended: "normal" },
  { cat: "everyday", en: "T-Shirt", ar: "تي شيرت", normal: 0.3, dry: 0.5, wet: 0.6, recommended: "normal" },
  { cat: "everyday", en: "Sweater", ar: "كنزة", normal: 0.7, dry: 1, wet: 1.2, recommended: "wet" },
  { cat: "everyday", en: "Socks", ar: "جوارب", normal: 0.2, dry: 0.3, wet: 0.4, recommended: "normal" },
  { cat: "everyday", en: "Military Uniform", ar: "زيّ عسكري", normal: 0.6, dry: null, wet: null, recommended: "normal" },
  { cat: "everyday", en: "Shoes", ar: "حذاء", normal: 1.5, dry: 1.75, wet: 2, recommended: "wet" },
  { cat: "everyday", en: "Trouser", ar: "بنطلون", normal: 0.4, dry: 0.6, wet: 0.7, recommended: "normal" },
  { cat: "everyday", en: "Overall", ar: "أفرول", normal: 1, dry: 1.25, wet: 1.5, recommended: "normal" },
  { cat: "everyday", en: "Jeans", ar: "جينز", normal: 0.4, dry: 0.6, wet: 0.7, recommended: "normal" },
  { cat: "everyday", en: "Bathrobe", ar: "روب حمّام", normal: 0.7, dry: 1, wet: 1.2, recommended: "normal" },
  { cat: "everyday", en: "Track Suit (2 pieces)", ar: "بدلة رياضية (قطعتان)", normal: 1, dry: null, wet: null, recommended: "normal" },
  { cat: "everyday", en: "Sport Bibs", ar: "صدرية رياضية", normal: 0.3, dry: null, wet: null, recommended: "normal" },
  { cat: "everyday", en: "Cap", ar: "قبعة", normal: 0.2, dry: 0.5, wet: 0.6, recommended: "normal" },

  // ── Formal & Outerwear ──
  { cat: "formal", en: "Jacket", ar: "جاكيت", normal: 1, dry: 1.4, wet: 1.7, recommended: "dry" },
  { cat: "formal", en: "Tie", ar: "ربطة عنق", normal: 0.2, dry: 0.5, wet: 0.6, recommended: "dry" },
  { cat: "formal", en: "Suit (Top Only)", ar: "بدلة (الجزء العلوي فقط)", normal: null, dry: 1.6, wet: 2, recommended: "dry" },
  { cat: "formal", en: "Suit (2 pieces)", ar: "بدلة قطعتان", normal: null, dry: 2.2, wet: 2.8, recommended: "dry" },
  { cat: "formal", en: "Suit (3 pieces)", ar: "بدلة ثلاث قطع", normal: null, dry: 2.7, wet: 3.2, recommended: "dry" },
  { cat: "formal", en: "Blazer", ar: "بليزر", normal: null, dry: 1.6, wet: 1.9, recommended: "dry" },
  { cat: "formal", en: "Leather Jacket", ar: "جاكيت جلد", normal: null, dry: 2.5, wet: null, recommended: "dry" },
  { cat: "formal", en: "Coat", ar: "معطف", normal: null, dry: 1.8, wet: 2.2, recommended: "dry" },
  { cat: "formal", en: "Overcoat", ar: "معطف طويل", normal: null, dry: 1.9, wet: null, recommended: "dry" },

  // ── Home & Other ──
  { cat: "home", en: "Kids Blanket", ar: "بطانية أطفال", normal: 1, dry: null, wet: null, recommended: "normal" },
  { cat: "home", en: "Bed Sheet (Double)", ar: "ملاءة سرير (مزدوج)", normal: 0.8, dry: 1.2, wet: 1.4, recommended: "normal" },
  { cat: "home", en: "Bed Sheet (Single)", ar: "ملاءة سرير (فردي)", normal: 0.5, dry: 0.9, wet: 1.1, recommended: "normal" },
  { cat: "home", en: "Blanket (Single)", ar: "بطانية (فردي)", normal: 1.7, dry: 2.2, wet: 2.6, recommended: "normal" },
  { cat: "home", en: "Blanket Big (Double)", ar: "بطانية كبيرة (مزدوج)", normal: 2.4, dry: 3, wet: 3.6, recommended: "normal" },
  { cat: "home", en: "Curtain", ar: "ستارة", normal: null, dry: 1.9, wet: 2.3, recommended: "dry" },
  { cat: "home", en: "Small Curtain", ar: "ستارة صغيرة", normal: 0.9, dry: 1.3, wet: 1.6, recommended: "dry" },
  { cat: "home", en: "Medium Curtain", ar: "ستارة متوسطة", normal: 1.3, dry: 1.9, wet: 2.3, recommended: "dry" },
  { cat: "home", en: "Large Curtain", ar: "ستارة كبيرة", normal: 1.7, dry: 2.4, wet: 2.9, recommended: "dry" },
  { cat: "home", en: "Carpet (Per Meter)", ar: "سجاد (للمتر)", normal: 1.7, dry: null, wet: null, recommended: "normal" },
  { cat: "home", en: "Pillow", ar: "وسادة", normal: 0.4, dry: 0.7, wet: 0.8, recommended: "normal" },
  { cat: "home", en: "Pillow Case", ar: "كيس وسادة", normal: 0.4, dry: 0.5, wet: 0.6, recommended: "normal" },
  { cat: "home", en: "Duvet Cover (Single)", ar: "غطاء لحاف (فردي)", normal: 1.5, dry: 2.3, wet: 2.8, recommended: "normal" },
  { cat: "home", en: "Duvet Cover (Double)", ar: "غطاء لحاف (مزدوج)", normal: 2, dry: 2.8, wet: 3.4, recommended: "normal" },
  { cat: "home", en: "Towel Large", ar: "منشفة كبيرة", normal: 0.6, dry: 0.8, wet: 1, recommended: "normal" },
  { cat: "home", en: "Towel Small", ar: "منشفة صغيرة", normal: 0.2, dry: 0.4, wet: 0.5, recommended: "normal" },
  { cat: "home", en: "Hand Towel", ar: "منشفة يد", normal: 0.3, dry: 0.5, wet: 0.6, recommended: "normal" },
  { cat: "home", en: "Bath Mat", ar: "سجادة حمّام", normal: 0.6, dry: 0.8, wet: 1, recommended: "normal" },
  { cat: "home", en: "Toilet Mat", ar: "سجادة مرحاض", normal: 0.6, dry: 0.6, wet: 0.7, recommended: "normal" },
  { cat: "home", en: "Sofa Cover", ar: "غطاء كنبة", normal: null, dry: 0.7, wet: 0.8, recommended: "dry" },
  { cat: "home", en: "Sofa Pillow Cover", ar: "غطاء وسادة كنبة", normal: null, dry: 0.3, wet: 0.4, recommended: "dry" },
  { cat: "home", en: "Doll (Small)", ar: "دمية (صغيرة)", normal: 0.1, dry: 0.2, wet: 0.2, recommended: "normal" },
  { cat: "home", en: "Doll (Large)", ar: "دمية (كبيرة)", normal: 0.4, dry: 0.6, wet: 0.7, recommended: "normal" },
  { cat: "home", en: "Handbag (Ladies)", ar: "حقيبة يد نسائية", normal: null, dry: 1.7, wet: 2, recommended: "dry" },
  { cat: "home", en: "Baby Bag", ar: "حقيبة أطفال", normal: null, dry: 2.3, wet: 2.8, recommended: "dry" },
  { cat: "home", en: "School Bag", ar: "حقيبة مدرسية", normal: null, dry: 1.1, wet: 1.3, recommended: "dry" },
];

export const priceLabel = (v: number | null): string =>
  v === null ? "-" : v.toFixed(3);

export const garmentName = (g: Garment, locale: Locale): string =>
  locale === "ar" ? g.ar : g.en;

export const categoryName = (id: CatId, locale: Locale): string => {
  const c = CATEGORIES.find((x) => x.id === id)!;
  return locale === "ar" ? c.ar : c.en;
};
