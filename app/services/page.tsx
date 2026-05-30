import {
  Clock3,
  Crown,
  Droplets,
  Home,
  Leaf,
  MessageCircle,
  Scissors,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  WashingMachine,
} from "lucide-react";

const premiumServices = [
  {
    title: "Hydro Dry Clean",
    icon: ShieldCheck,
    description:
      "Premium dry cleaning for dishdashas, suits, bishts, and structured garments.",
  },
  {
    title: "WET Clean",
    icon: Droplets,
    description:
      "Controlled professional wet cleaning for delicate garments, abayas, silk, and premium fabrics.",
  },
];

const services = [
  {
    title: "Normal Wash",
    icon: WashingMachine,
    description:
      "Reliable everyday washing for regular garments and daily-use fabrics.",
  },
  {
    title: "Dishdasha Care",
    icon: Shirt,
    description:
      "Professional care for dishdashas with proper structure, collar care, and finishing.",
  },
  {
    title: "Abaya Care",
    icon: Sparkles,
    description:
      "Gentle cleaning and finishing for abayas, embroidery, and delicate fabrics.",
  },
  {
    title: "Home Textiles",
    icon: Home,
    description:
      "Cleaning for bedsheets, blankets, curtains, and household fabrics.",
  },
  {
    title: "Stain Treatment",
    icon: ShieldCheck,
    description:
      "Careful stain assessment and treatment while protecting fabric quality.",
  },
  {
    title: "Pressing & Finishing",
    icon: Scissors,
    description:
      "Neat pressing and final finishing so garments return ready to wear.",
  },
];

export default function ServicesPage() {
  return (
    <main
      className="min-h-screen px-4 py-12 md:px-6 md:py-16"
      style={{
        backgroundColor: "#c6c1bb",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "760px",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#26364d] md:text-6xl">
            Services
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            Premium garment care using advanced cleaning methods, modern
            equipment, and careful finishing.
          </p>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          {premiumServices.map((service) => {
            const Icon = service.icon;

            return (
              <article
                key={service.title}
                className="rounded-[30px] bg-[#26364d]/95 p-7 text-white shadow-2xl backdrop-blur md:p-8"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-[#d8b98a]">
                  <Icon size={34} />
                </div>

                <h2 className="text-3xl font-bold">{service.title}</h2>

                <p className="mt-4 text-base leading-8 text-white/80">
                  {service.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-10 rounded-[30px] bg-white/90 p-5 shadow-2xl backdrop-blur md:p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#26364d] md:text-4xl">
              Complete Garment Care
            </h2>

            <p className="mt-3 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
              A full range of services for daily wear, traditional garments,
              delicate pieces, and household fabrics.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article
                  key={service.title}
                  className="rounded-3xl border border-[#ece7e1] bg-white p-6 shadow-sm"
                >
                  <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl bg-[#f8f1e7] text-[#b9925d]">
                    <Icon size={27} />
                  </div>

                  <h3 className="text-xl font-bold text-[#26364d]">
                    {service.title}
                  </h3>

                  <p className="mt-3 leading-7 text-[#546d83]">
                    {service.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid rounded-3xl bg-[#26364d]/95 text-white shadow-2xl backdrop-blur md:grid-cols-4">
          <Feature
            icon={<Crown />}
            title="Premium Care"
            text="Expert care for every fabric"
          />
          <Feature
            icon={<Settings />}
            title="Advanced Technology"
            text="Modern machines, better results"
          />
          <Feature
            icon={<Leaf />}
            title="Fabric Safe"
            text="Gentle on fabric, tough on dirt"
          />
          <Feature
            icon={<Clock3 />}
            title="On-Time Promise"
            text="Always on time, every time"
          />
        </section>

        <div className="mt-10 text-center">
          <a
            href="https://wa.me/96895449977"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#26364d] px-7 py-4 font-semibold text-white shadow-lg transition hover:scale-105"
          >
            <MessageCircle size={20} />
            Contact on WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4 border-white/10 px-6 py-6 md:border-r md:px-8 md:py-7 last:border-r-0">
      <div className="text-[#d8b98a]">{icon}</div>

      <div>
        <h3 className="text-base font-bold md:text-lg">{title}</h3>
        <p className="mt-1 text-sm text-white/80">{text}</p>
      </div>
    </div>
  );
}