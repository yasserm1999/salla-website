import Link from "next/link";
import {
  Cpu,
  ClipboardCheck,
  Users,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Droplets,
  Waves,
} from "lucide-react";

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#26364d] text-white">
        <img
          src="/hero-counter.png"
          alt="Salla premium garment care"
          className="absolute inset-0 h-full w-full object-cover brightness-110 contrast-110"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#26364d] via-[#26364d]/85 to-[#26364d]/10" />

        <div className="relative mx-auto -mt-8 max-w-6xl px-6 pb-10">
          <div className="max-w-2xl">
            <img
              src="/logoa.png"
              alt="Salla Arabic Logo"
              className="mb-1 h-70 w-auto object-contain"
            />

            <p className="mb-4 text- font-semibold uppercase tracking-[0.3em] text-[#9cb2bf]">
              Professional Wet & Dry Cleaning
            </p>

            <h1 className="text-5xl font-bold leading-tight md:text-5xl">
              Care Beyond Clean.
              <br />
              Quality You Can Trust.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/90">
              Salla delivers premium garment care through advanced technology,
              reliable processes, and skilled staff.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="https://wa.me/96895449977"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#9cb2bf] px-7 py-4 font-semibold text-[#26364d] transition hover:scale-105"
              >
                <MessageCircle size={20} />
                Contact on WhatsApp
              </a>

              <Link
                href="/tracker"
                className="rounded-2xl border border-white/30 bg-white/10 px-7 py-4 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Track Order
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto -mt-16 max-w-6xl px-6 pb-10">
          <div className="mt-24 grid rounded-3xl bg-[#26364d]/95 p-6 text-white shadow-2xl backdrop-blur md:grid-cols-4">
            <Feature icon={<Cpu />} title="Advanced Technology" />
            <Feature icon={<ShieldCheck />} title="Reliable Processes" />
            <Feature icon={<Users />} title="Skilled Team" />
            <Feature icon={<Sparkles />} title="Premium Care" />
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section
        className="px-6 py-20"
        style={{
          backgroundColor: "#c6c1bb",
          backgroundImage: "url('/pattern.png')",
          backgroundSize: "800px",
          backgroundRepeat: "repeat",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold text-[#26364d] md:text-5xl">
              About Us
            </h2>
            <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-[#546d83]" />
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <InfoCard
              icon={<Cpu />}
              title="Advanced Technology"
              text="We use modern cleaning systems that go beyond the usual market standard, with Hydrocarbon Dry Cleaning and Professional Wet Cleaning."
            />

            <InfoCard
              icon={<ClipboardCheck />}
              title="Strong Processes"
              text="Our workflow is designed so garments are tracked properly and no clothing is missed during handling and delivery."
            />

            <InfoCard
              icon={<Users />}
              title="Skilled Team"
              text="Our employees are trained to deliver consistent, high-quality service with attention to detail and fabric care."
            />
          </div>
        </div>
      </section>

      {/* DIFFERENT */}
      <section className="bg-gradient-to-br from-[#e8f0f4] to-[#c7d7df] px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-[#26364d] md:text-5xl">
            What makes Salla different?
          </h2>

          <p className="mx-auto max-w-3xl text-lg leading-8 text-[#26364d]">
            Our two main strengths are Hydrocarbon Dry Cleaning and Professional
            Wet Cleaning. These are the core of our service and the reason we
            offer a better standard of garment care.
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-white/70 p-8 text-left shadow-lg backdrop-blur">
              <Droplets className="mb-4 text-[#26364d]" size={42} />
              <h3 className="text-2xl font-bold text-[#26364d]">
                Professional Wet Cleaning
              </h3>
              <p className="mt-3 leading-7 text-[#3f4f61]">
                Gentle on fabrics, tough on stains. Perfect for delicate and
                everyday garments.
              </p>
            </div>

            <div className="rounded-3xl bg-white/70 p-8 text-left shadow-lg backdrop-blur">
              <Waves className="mb-4 text-[#26364d]" size={42} />
              <h3 className="text-2xl font-bold text-[#26364d]">
                Hydrocarbon Dry Cleaning
              </h3>
              <p className="mt-3 leading-7 text-[#3f4f61]">
                Advanced cleaning with no harsh odors or residue. Safer for you
                and your clothes.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
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

function Feature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-4 border-white/10 px-4 py-3 md:border-r last:border-r-0">
      <div className="text-[#9cb2bf]">{icon}</div>
      <p className="font-semibold">{title}</p>
    </div>
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
    <div className="rounded-3xl bg-white p-8 text-center shadow-xl transition hover:-translate-y-1">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#e8e2dc] text-[#26364d]">
        {icon}
      </div>

      <h3 className="mb-4 text-2xl font-bold text-[#26364d]">{title}</h3>

      <p className="leading-7 text-[#3f4f61]">{text}</p>
    </div>
  );
}