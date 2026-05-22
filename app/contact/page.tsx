import { Mail, MessageCircle, MapPin, Clock3 } from "lucide-react";

export default function ContactPage() {
  return (
    <main
      className="min-h-screen px-4 py-14 md:px-6 md:py-20"
      style={{
        backgroundColor: "#c6c1bb",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "760px",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="mx-auto max-w-6xl">
<div className="mb-10 text-center md:mb-14">
  <h1 className="text-5xl font-bold text-[#26364d] md:text-6xl">
    Contact Us
  </h1>

  <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg md:leading-8">
    Reach Salla for pricing, service inquiries, and garment care support.
  </p>
</div>

        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8">
          <div className="rounded-[30px] bg-white/90 p-5 shadow-2xl backdrop-blur md:rounded-[34px] md:p-10">
            <h2 className="text-2xl font-bold text-[#26364d] md:text-3xl">
              How can we help?
            </h2>

            <div className="mt-6 space-y-3 md:mt-8 md:space-y-4">
              <a
                href="https://wa.me/96895449977"
                target="_blank"
                className="flex items-center gap-3 rounded-2xl bg-[#26364d] px-4 py-4 text-sm font-semibold text-white transition hover:scale-[1.02] md:gap-4 md:px-6 md:py-5 md:text-base"
              >
                <MessageCircle className="shrink-0" />
                <span>WhatsApp: 95449977</span>
              </a>

              <a
                href="mailto:yasser@sallalaundry.com"
                className="flex items-center gap-3 rounded-2xl border border-[#d8e1e7] bg-white px-4 py-4 text-sm font-semibold text-[#26364d] transition hover:scale-[1.02] md:gap-4 md:px-6 md:py-5 md:text-base"
              >
                <Mail className="shrink-0" />
                <span className="break-all">yasser@sallalaundry.com</span>
              </a>

              <a
                href="mailto:osama@sallalaundry.com"
                className="flex items-center gap-3 rounded-2xl border border-[#d8e1e7] bg-white px-4 py-4 text-sm font-semibold text-[#26364d] transition hover:scale-[1.02] md:gap-4 md:px-6 md:py-5 md:text-base"
              >
                <Mail className="shrink-0" />
                <span className="break-all">osama@sallalaundry.com</span>
              </a>

              <a
                href="https://instagram.com/salla.laundry"
                target="_blank"
                className="flex items-center gap-3 rounded-2xl bg-[#9cb2bf]/80 px-4 py-4 text-sm font-semibold text-[#26364d] transition hover:scale-[1.02] md:gap-4 md:px-6 md:py-5 md:text-base"
              >
                <span className="shrink-0 text-xl">📷</span>
                <span>Instagram: salla.laundry</span>
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-4">
              <div className="rounded-2xl bg-[#f7f3ed] p-4 text-center md:p-5">
                <p className="text-2xl font-bold text-[#26364d] md:text-3xl">
                  WET
                </p>
                <p className="mt-1 text-xs leading-5 text-[#546d83] md:text-sm">
                  Professional Wet Cleaning
                </p>
              </div>

              <div className="rounded-2xl bg-[#f7f3ed] p-4 text-center md:p-5">
                <p className="text-2xl font-bold text-[#26364d] md:text-3xl">
                  Hydro
                </p>
                <p className="mt-1 text-xs leading-5 text-[#546d83] md:text-sm">
                  Hydrocarbon Dry Cleaning
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] bg-[#26364d] p-5 text-white shadow-2xl md:rounded-[34px] md:p-10">
            <h2 className="text-2xl font-bold md:text-3xl">Salla Laundry</h2>

            <p className="mt-4 text-sm leading-7 text-white/80 md:text-base md:leading-8">
              Professional wet and dry cleaning with premium garment care,
              reliable processes, and modern cleaning standards.
            </p>

            <div className="mt-6 space-y-4 md:mt-8 md:space-y-5">
              <div className="flex gap-3 md:gap-4">
                <MapPin className="shrink-0 text-[#d8b98a]" />
                <p>Muscat, Oman</p>
              </div>

              <div className="flex gap-3 md:gap-4">
                <Clock3 className="shrink-0 text-[#d8b98a]" />
                <p>Contact us anytime for inquiries and support.</p>
              </div>

              <div className="flex gap-3 md:gap-4">
                <MessageCircle className="shrink-0 text-[#d8b98a]" />
                <p>Fastest response is through WhatsApp.</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 shadow-lg md:mt-8">
              <iframe
                src="https://maps.google.com/maps?q=23.593296,58.447741&z=16&output=embed"
                width="100%"
                height="240"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[220px] md:h-[240px]"
              />
            </div>

            <div className="mt-6 rounded-3xl bg-white/10 p-5 md:mt-10 md:p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-[#d8b98a] md:text-sm">
                Premium Care
              </p>

              <p className="mt-3 text-lg font-bold md:text-xl">
                Clean. Reliable. Professional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}