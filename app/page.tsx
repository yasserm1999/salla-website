import Link from "next/link";
import { Cpu, ClipboardCheck, Users, MessageCircle } from "lucide-react";

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="bg-gradient-to-r from-[#26364d] to-[#546d83] px-6 py-5 text-center text-white">
        <div className="mx-auto max-w-4xl">
<img
  src="/logoa.png"
  alt="Salla Arabic Logo"
  className="mx-auto mb-1 h-60 w-auto object-contain"
/>

<p className="text-xl text-[#9cb2bf]">
  Professional Wet & Dry Cleaning
</p>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-white/90">
            Salla is not the usual market player. We deliver professional garment
            care through advanced technology, reliable processes, and skilled staff.
          </p>

          <a
            href="https://wa.me/96895449977"
            target="_blank"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#9cb2bf] px-6 py-3 font-semibold text-[#26364d] transition hover:scale-105"
          >
            <MessageCircle size={20} />
            Contact on WhatsApp
          </a>
        </div>
      </section>

      {/* ABOUT */}
      <section className="bg-[#c6c1bb] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-4xl font-bold">About Us</h2>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <Cpu className="mb-5 text-[#546d83]" size={42} />
              <h3 className="mb-3 text-2xl font-bold">Advanced Technology</h3>
              <p className="leading-7 text-[#3f4f61]">
                We use modern cleaning systems that go beyond the usual market
                standard, with Hydrocarbon Dry Cleaning and Professional Wet Cleaning.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <ClipboardCheck className="mb-5 text-[#546d83]" size={42} />
              <h3 className="mb-3 text-2xl font-bold">Strong Processes</h3>
              <p className="leading-7 text-[#3f4f61]">
                Our workflow is designed so garments are tracked properly and no
                clothing is missed during handling and delivery.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <Users className="mb-5 text-[#546d83]" size={42} />
              <h3 className="mb-3 text-2xl font-bold">Skilled Team</h3>
              <p className="leading-7 text-[#3f4f61]">
                Our employees are trained to deliver consistent, high-quality service
                with attention to detail and fabric care.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENT */}
      <section className="bg-[#9cb2bf] px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-4xl font-bold">
            What makes Salla different?
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-8">
            Our two main strengths are Hydrocarbon Dry Cleaning and Professional
            Wet Cleaning. These are the core of our service and the reason we
            offer a better standard of garment care.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/services"
              className="rounded-xl bg-[#26364d] px-6 py-3 font-semibold text-white"
            >
              View Services
            </Link>

            <Link
              href="/prices"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-[#26364d]"
            >
              View Prices
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}