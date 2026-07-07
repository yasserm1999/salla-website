import Link from "next/link";
import { Gift, Clock3, MessageCircle } from "lucide-react";

export default function LoyaltyPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-16 md:px-6"
      style={{
        backgroundColor: "#c6c1bb",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "760px",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="mx-auto max-w-xl rounded-[34px] bg-white/90 p-8 text-center shadow-2xl backdrop-blur md:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#26364d] text-[#d8b98a] shadow-xl">
          <Gift size={40} />
        </div>

        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d8b98a]/20 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-[#b9925d]">
          <Clock3 size={16} />
          Coming Soon
        </span>

        <h1 className="mt-5 text-4xl font-bold text-[#26364d] md:text-5xl">
          Salla Loyalty
        </h1>

        <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[#546d83] md:text-lg">
          Our loyalty rewards program is on its way. Soon you&apos;ll earn points
          on every order and redeem them for credit. Stay tuned!
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="https://wa.me/96895449977"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#26364d] px-7 py-4 font-semibold text-white shadow-lg transition hover:scale-105"
          >
            <MessageCircle size={20} />
            Contact on WhatsApp
          </a>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-[#26364d] bg-white px-7 py-4 font-semibold text-[#26364d] transition hover:scale-105"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
