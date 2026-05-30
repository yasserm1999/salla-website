"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/prices", label: "Prices" },
  { href: "/calculator", label: "Calculator" },
  { href: "/loyalty", label: "Loyalty" },
  { href: "/team", label: "Our Team" },
  { href: "/tracker", label: "Track Order" },
  { href: "/contact", label: "Contact Us" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#26364d] text-white shadow-md">
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
        <nav className="hidden gap-6 text-sm font-medium md:flex md:text-base">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[#9cb2bf]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <div className="relative md:hidden">
          <button
            onClick={() => setOpen(!open)}
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
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-[#eef2f4] px-5 py-4 text-sm font-semibold transition hover:bg-[#c6c1bb]/30"
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