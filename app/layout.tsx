import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Salla - Professional Wet & Dry Cleaning",
  description:
    "Salla offers professional wet cleaning and hydrocarbon dry cleaning with advanced technology and reliable processes.",
  openGraph: {
    title: "Salla - Professional Wet & Dry Cleaning",
    description:
      "Salla offers professional wet cleaning and hydrocarbon dry cleaning.",
    url: "https://sallalaundry.com",
    siteName: "Salla",
    images: [
      {
        url: "https://sallalaundry.com/preview.png",
        width: 1200,
        height: 630,
        alt: "Salla Professional Wet & Dry Cleaning",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-[#26364d]">
        <header className="sticky top-0 z-50 bg-[#26364d] text-white shadow-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center">
              <img
                src="/logo.png"
                alt="Salla Logo"
                className="h-14 w-auto object-contain"
              />
            </Link>

            <nav className="hidden gap-6 text-sm font-medium md:flex md:text-base">
              <Link href="/" className="hover:text-[#9cb2bf]">
                About Us
              </Link>
              <Link href="/services" className="hover:text-[#9cb2bf]">
                Services
              </Link>
              <Link href="/prices" className="hover:text-[#9cb2bf]">
                Prices
              </Link>
              <Link href="/calculator" className="hover:text-[#9cb2bf]">
                Calculator
              </Link>
            </nav>

            <details className="relative md:hidden">
              <summary className="cursor-pointer list-none rounded-lg bg-[#546d83] px-4 py-2 text-sm font-semibold">
                Menu
              </summary>

              <div className="absolute right-0 mt-3 flex w-44 flex-col overflow-hidden rounded-xl bg-white text-[#26364d] shadow-xl">
                <Link href="/" className="px-4 py-3 hover:bg-[#eef2f4]">
                  About Us
                </Link>
                <Link href="/services" className="px-4 py-3 hover:bg-[#eef2f4]">
                  Services
                </Link>
                <Link href="/prices" className="px-4 py-3 hover:bg-[#eef2f4]">
                  Prices
                </Link>
                <Link
                  href="/calculator"
                  className="px-4 py-3 hover:bg-[#eef2f4]"
                >
                  Calculator
                </Link>
              </div>
            </details>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}