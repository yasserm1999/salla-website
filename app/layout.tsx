import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";

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
        <Header />
        {children}
      </body>
    </html>
  );
}