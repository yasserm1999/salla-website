"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/prices", label: "Prices" },
  { href: "/calculator", label: "Calculator" },
  { href: "/contact", label: "Contact Us" },
  { href: "/tracker", label: "Track Order" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#26364d] text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt="Salla Logo" className="h-14 w-auto object-contain" />
        </Link>

        <nav className="hidden gap-6 text-sm font-medium md:flex md:text-base">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-[#9cb2bf]">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="relative md:hidden">
          <button
            onClick={() => setOpen(!open)}
            className="rounded-full bg-[#546d83] px-5 py-2 text-sm font-semibold shadow-md"
          >
            Menu
          </button>

          {open && (
            <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl bg-white text-[#26364d] shadow-2xl">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-[#eef2f4] px-5 py-4 text-sm font-semibold hover:bg-[#c6c1bb]/40"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}