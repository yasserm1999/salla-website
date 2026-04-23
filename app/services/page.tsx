import {
  Droplets,
  ShieldCheck,
  Shirt,
  Sparkles,
  Home,
  Scissors,
  MessageCircle,
} from "lucide-react";

export default function ServicesPage() {
  return (
    <main>
      <section className="bg-gradient-to-r from-[#26364d] to-[#546d83] px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 text-5xl font-bold md:text-6xl">Our Services</h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-white/90">
            Salla offers advanced garment care through premium cleaning
            technologies and a complete range of professional fabric care
            services.
          </p>
        </div>
      </section>

      <section className="bg-[#c6c1bb] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold">
            Premium Cleaning Technologies
          </h2>
          <p className="mx-auto mb-10 max-w-3xl text-center text-lg leading-8 text-[#3f4f61]">
            Our premium services are built around two advanced cleaning methods
            that set Salla apart from the usual market players.
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <ShieldCheck className="mb-5 text-[#546d83]" size={46} />
              <h3 className="mb-4 text-3xl font-bold">
                Hydrocarbon Dry Cleaning
              </h3>
              <p className="mb-4 leading-8 text-[#3f4f61]">
                Hydrocarbon Dry Cleaning is one of Salla’s premium services. It
                is a professional solvent-based cleaning method designed for
                garments that need more refined care.
              </p>
              <p className="mb-4 leading-8 text-[#3f4f61]">
                Compared with the commonly used PERC process in the market,
                hydrocarbon cleaning is gentler on fabrics and is a better
                option for health and environmental consideration.
              </p>
              <p className="leading-8 text-[#3f4f61]">
                It is ideal for structured garments, luxury pieces, and fabrics
                that need excellent cleaning while preserving texture, feel, and
                finish.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <Droplets className="mb-5 text-[#546d83]" size={46} />
              <h3 className="mb-4 text-3xl font-bold">
                Professional Wet Cleaning
              </h3>
              <p className="mb-4 leading-8 text-[#3f4f61]">
                Professional Wet Cleaning is also one of Salla’s premium
                services. It is not normal washing. It is a controlled cleaning
                process that uses water, specialized detergents, and precise
                machine programs.
              </p>
              <p className="mb-4 leading-8 text-[#3f4f61]">
                At Salla, this service is enhanced through advanced Girbau and
                GWET washer technology for delicate and premium garments.
              </p>
              <p className="leading-8 text-[#3f4f61]">
                It is ideal for garments that need careful handling,
                fabric-sensitive treatment, and high-quality finishing.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#9cb2bf] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold">
            Complete Garment Care Services
          </h2>
          <p className="mx-auto mb-10 max-w-3xl text-center text-lg leading-8 text-[#26364d]">
            In addition to our premium cleaning technologies, Salla provides a
            full range of garment care services for everyday wear, traditional
            garments, delicate items, and household fabrics.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Shirt className="mb-4 text-[#546d83]" size={38} />
              <h3 className="mb-2 text-xl font-bold">Normal Wash</h3>
              <p className="leading-7 text-[#3f4f61]">
                Everyday washing service for regular garments that need reliable
                cleaning and fresh finishing.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Sparkles className="mb-4 text-[#546d83]" size={38} />
              <h3 className="mb-2 text-xl font-bold">Dishdasha Care</h3>
              <p className="leading-7 text-[#3f4f61]">
                Professional care for dishdashas with proper treatment,
                finishing, and presentation.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Sparkles className="mb-4 text-[#546d83]" size={38} />
              <h3 className="mb-2 text-xl font-bold">Abaya Care</h3>
              <p className="leading-7 text-[#3f4f61]">
                Gentle and professional cleaning for abayas and delicate
                traditional garments.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Home className="mb-4 text-[#546d83]" size={38} />
              <h3 className="mb-2 text-xl font-bold">Home Textiles</h3>
              <p className="leading-7 text-[#3f4f61]">
                Cleaning solutions for blankets, bedding, curtains, and other
                household fabric items.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Sparkles className="mb-4 text-[#546d83]" size={38} />
              <h3 className="mb-2 text-xl font-bold">Stain Treatment</h3>
              <p className="leading-7 text-[#3f4f61]">
                Careful stain assessment and treatment to improve garment
                appearance while protecting fabric condition.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Scissors className="mb-4 text-[#546d83]" size={38} />
              <h3 className="mb-2 text-xl font-bold">Pressing & Finishing</h3>
              <p className="leading-7 text-[#3f4f61]">
                Final presentation and pressing to ensure garments return neat,
                polished, and ready to wear.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <a
              href="https://wa.me/96895449977"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl bg-[#26364d] px-6 py-3 font-semibold text-white transition hover:scale-105"
            >
              <MessageCircle size={20} />
              Contact on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}