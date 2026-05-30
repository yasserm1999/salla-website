import Link from "next/link";
import {
  Cpu,
  ClipboardCheck,
  Users,
  MessageCircle,
  Droplets,
  Waves,
  Gift,
} from "lucide-react";

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden bg-[#26364d] text-white">
        <img
          src="/hero-counter.png"
          alt="Salla premium garment care"
          className="absolute inset-0 h-full w-full object-cover brightness-110 contrast-110"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#26364d] via-[#26364d]/90 to-[#26364d]/20" />

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-16 md:min-h-[650px] md:px-6 md:py-20">
          <div className="max-w-2xl">
            <img
              src="/logoa.png"
              alt="Salla Arabic Logo"
              className="mb-2 h-40 w-auto object-contain md:h-56"
            />

            <p className="mb-4 text-base font-semibold uppercase tracking-[0.18em] text-[#d9e3ea] md:text-xl md:tracking-[0.2em]">
              Professional Wet & Dry Cleaning
            </p>

            <h1 className="text-4xl font-bold leading-tight md:text-6xl">
              <span className="text-white">Care Beyond Clean.</span>
              <br />
              <span className="text-[#9cb2bf]">Quality You Can Trust.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/90 md:text-lg md:leading-8">
              Salla delivers premium garment care through advanced technology,
              reliable processes, and skilled staff.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:gap-4">
              <a
                href="https://wa.me/96895449977"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#9cb2bf] px-6 py-4 font-semibold text-[#26364d] transition hover:scale-105"
              >
                <MessageCircle size={20} />
                Contact on WhatsApp
              </a>

              <Link
                href="/tracker"
                className="inline-flex justify-center rounded-2xl border border-white/30 bg-white/10 px-6 py-4 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Track Order
              </Link>

              <Link
  href="/loyalty"
 className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8b98a]/40 bg-[#d8b98a]/10 px-6 py-4 font-semibold text-white transition hover:bg-[#d8b98a]/15"
>
  <Gift className="text-[#d8b98a]" size={18} />
  Loyalty
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        className="px-5 py-16 md:px-6 md:py-20"
        style={{
          backgroundColor: "#c6c1bb",
          backgroundImage: "url('/pattern.png')",
          backgroundSize: "800px",
          backgroundRepeat: "repeat",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center md:mb-12">
            <h2 className="text-4xl font-bold text-[#26364d] md:text-5xl">
              About Us
            </h2>
            <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-[#546d83]" />
          </div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            <InfoCard
              icon={<Cpu />}
              title="Advanced Technology"
              text="We use modern cleaning systems that go beyond the usual market standard, with Hydrocarbon Dry Cleaning and Professional Wet Cleaning."
            />

            <InfoCard
              icon={<ClipboardCheck />}
              title="Strong Processes"
              text="Our workflow is designed so garments are tracked properly and no clothing is missed during handling."
            />

            <InfoCard
              icon={<Users />}
              title="Skilled Team"
              text="Our employees are trained to deliver consistent, high-quality service with attention to detail and fabric care."
            />
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#e8f0f4] to-[#c7d7df] px-5 py-16 md:px-6 md:py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            <span className="text-[#26364d]">What makes Salla</span>{" "}
            <span className="text-[#546d83]">different?</span>
          </h2>

          <p className="mx-auto max-w-3xl text-base leading-7 text-[#26364d] md:text-lg md:leading-8">
            Our two main strengths are Hydrocarbon Dry Cleaning and Professional
            Wet Cleaning. These are the core of our service and the reason we
            offer a better standard of garment care.
          </p>

          <div className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
            <div className="rounded-3xl bg-white/75 p-6 text-left shadow-lg backdrop-blur md:p-8">
              <Droplets className="mb-4 text-[#7aa6b8]" size={42} />
              <h3 className="text-2xl font-bold">
                <span className="text-[#26364d]">Professional</span>{" "}
                <span className="text-[#7aa6b8]">Wet Cleaning</span>
              </h3>
              <p className="mt-3 leading-7 text-[#3f4f61]">
                Gentle on fabrics, tough on stains. Perfect for delicate and
                everyday garments.
              </p>
            </div>

            <div className="rounded-3xl bg-white/75 p-6 text-left shadow-lg backdrop-blur md:p-8">
              <Waves className="mb-4 text-[#546d83]" size={42} />
              <h3 className="text-2xl font-bold">
                <span className="text-[#26364d]">Hydrocarbon</span>{" "}
                <span className="text-[#546d83]">Dry Cleaning</span>
              </h3>
              <p className="mt-3 leading-7 text-[#3f4f61]">
                Advanced cleaning with no harsh odors or residue. Safer for you
                and your clothes.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap md:gap-4">
            <Link
              href="/services"
              className="rounded-2xl bg-[#26364d] px-8 py-4 font-semibold text-white shadow-lg transition hover:scale-105"
            >
              View Services
            </Link>

            <Link
              href="/prices"
              className="rounded-2xl border border-[#26364d] bg-white px-8 py-4 font-semibold text-[#26364d] transition hover:scale-105"
            >
              View Prices
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-xl transition hover:-translate-y-1 md:p-8">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#e8f0f4] text-[#546d83]">
        {icon}
      </div>

      <h3 className="mb-4 text-2xl font-bold text-[#26364d]">{title}</h3>

      <p className="leading-7 text-[#3f4f61]">{text}</p>
    </div>
  );
}