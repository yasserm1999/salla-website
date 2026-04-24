export default function ContactPage() {
  return (
    <main className="bg-[#c6c1bb] px-6 py-20">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-xl md:p-12">
        <h1 className="mb-4 text-center text-4xl font-bold text-[#26364d] md:text-6xl">
          Contact Us
        </h1>

        <p className="mb-10 text-center text-[#546d83]">
          Reach Salla for pickup, delivery, pricing, and service inquiries.
        </p>

        <div className="grid gap-5">
          <a
            href="https://wa.me/96895449977"
            target="_blank"
            className="rounded-2xl bg-[#26364d] px-6 py-4 text-center font-semibold text-white hover:bg-[#546d83]"
          >
            WhatsApp: 95449977
          </a>

          <a
            href="mailto:yasser@sallalaundry.com"
            className="rounded-2xl border border-[#d8e1e7] px-6 py-4 text-center font-semibold hover:bg-[#f5f3f0]"
          >
            yasser@sallalaundry.com
          </a>

          <a
            href="mailto:osama@sallalaundry.com"
            className="rounded-2xl border border-[#d8e1e7] px-6 py-4 text-center font-semibold hover:bg-[#f5f3f0]"
          >
            osama@sallalaundry.com
          </a>

          <a
            href="https://www.instagram.com/salla.laundry"
            target="_blank"
            className="flex items-center justify-center gap-3 rounded-2xl bg-[#9cb2bf] px-6 py-4 font-semibold text-[#26364d] hover:bg-[#8aa4b3]"
          >
            <span className="text-xl">📷</span>
            Instagram: Salla.laundry
          </a>
        </div>
      </div>
    </main>
  );
}