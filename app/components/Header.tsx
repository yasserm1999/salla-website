"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Globe, Menu, X } from "lucide-react";

const navLinks = [
  { href: "/", arHref: "/ar", label: "About Us", labelAr: "من نحن" },
  { href: "/services", arHref: "/ar/services", label: "Services", labelAr: "الخدمات" },
  { href: "/prices", arHref: "/ar/prices", label: "Prices", labelAr: "الأسعار" },
  { href: "/calculator", arHref: "/ar/calculator", label: "Calculator", labelAr: "حاسبة الأسعار" },
  { href: "/loyalty", arHref: "/ar/loyalty", label: "Loyalty", labelAr: "الولاء" },
  { href: "/team", arHref: "/ar/team", label: "Our Team", labelAr: "فريقنا" },
  { href: "/tracker", arHref: "/ar/tracker", label: "Track Order", labelAr: "تتبّع الطلب" },
  { href: "/contact", arHref: "/ar/contact", label: "Contact Us", labelAr: "تواصل معنا" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const isArabic = pathname.startsWith("/ar");

  // Map the current page to its counterpart in the other language.
  const toEnglish = (p: string) => {
    const stripped = p.replace(/^\/ar/, "");
    return stripped === "" ? "/" : stripped;
  };
  const toArabic = (p: string) => (p === "/" ? "/ar" : `/ar${p}`);
  const toggleHref = isArabic ? toEnglish(pathname) : toArabic(pathname);

  // Language toggle: AR on the English site, EN when viewing an Arabic page.
  const langToggle = (
    <Link
      href={toggleHref}
      onClick={() => setOpen(false)}
      aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d8b98a]/50 bg-[#d8b98a]/10 px-3.5 py-1.5 text-sm font-semibold text-[#d8b98a] transition hover:bg-[#d8b98a]/20"
    >
      <Globe size={16} />
      {isArabic ? "EN" : "AR"}
    </Link>
  );

  return (
    <header
      dir={isArabic ? "rtl" : "ltr"}
      className="sticky top-0 z-50 bg-[#26364d] text-white shadow-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="Salla Logo"
            className="h-14 w-auto object-contain"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
          <nav className="flex gap-6 text-sm font-medium md:text-base">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={isArabic ? link.arHref : link.href}
                className="transition hover:text-[#9cb2bf]"
              >
                {isArabic ? link.labelAr : link.label}
              </Link>
            ))}
          </nav>

          {langToggle}
        </div>

        {/* Mobile: language toggle + menu button */}
        <div className="flex items-center gap-2 md:hidden">
          {langToggle}

          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="rounded-full bg-[#546d83] p-3 shadow-md"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile Dropdown */}
            {open && (
              <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl bg-white text-[#26364d] shadow-2xl">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={isArabic ? link.arHref : link.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-[#eef2f4] px-5 py-4 text-sm font-semibold transition hover:bg-[#c6c1bb]/30"
                  >
                    {isArabic ? link.labelAr : link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}