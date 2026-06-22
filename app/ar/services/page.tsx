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
    title: "التنظيف الجاف بالهيدروكربون",
    icon: ShieldCheck,
    description:
      "تنظيف جاف متميّز للدشاديش والبدلات والبشوت والملابس ذات القَصّات المنظّمة.",
  },
  {
    title: "التنظيف الرطب الاحترافي",
    icon: Droplets,
    description:
      "تنظيف رطب احترافي مُتحكَّم به للملابس الرقيقة والعبايات والحرير والأقمشة الفاخرة.",
  },
];

const services = [
  {
    title: "الغسيل العادي",
    icon: WashingMachine,
    description:
      "غسيل يومي موثوق للملابس الاعتيادية والأقمشة ذات الاستخدام اليومي.",
  },
  {
    title: "العناية بالدشداشة",
    icon: Shirt,
    description:
      "عناية احترافية بالدشاديش مع الحفاظ على القَصّة والاهتمام بالياقة واللمسات النهائية.",
  },
  {
    title: "العناية بالعباية",
    icon: Sparkles,
    description:
      "تنظيف لطيف ولمسات نهائية للعبايات والتطريز والأقمشة الرقيقة.",
  },
  {
    title: "المنسوجات المنزلية",
    icon: Home,
    description:
      "تنظيف للملاءات والبطانيات والستائر والأقمشة المنزلية.",
  },
  {
    title: "معالجة البقع",
    icon: ShieldCheck,
    description:
      "تقييم دقيق للبقع ومعالجتها مع الحفاظ على جودة القماش.",
  },
  {
    title: "الكي واللمسات النهائية",
    icon: Scissors,
    description:
      "كيٌّ متقن ولمسات نهائية بحيث تعود الملابس جاهزة للارتداء.",
  },
];

export default function ServicesPageAr() {
  return (
    <main
      dir="rtl"
      lang="ar"
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
            الخدمات
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
            عناية متميّزة بالملابس باستخدام أحدث طرق التنظيف والمعدّات الحديثة
            واللمسات النهائية الدقيقة.
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
              عناية متكاملة بالملابس
            </h2>

            <p className="mt-3 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg">
              مجموعة متكاملة من الخدمات للملابس اليومية والملابس التقليدية
              والقطع الرقيقة والأقمشة المنزلية.
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
            title="عناية متميّزة"
            text="عناية خبيرة بكل نوع من الأقمشة"
          />
          <Feature
            icon={<Settings />}
            title="تقنية متطوّرة"
            text="آلات حديثة ونتائج أفضل"
          />
          <Feature
            icon={<Leaf />}
            title="آمن على الأقمشة"
            text="لطيف على القماش وفعّال على الأوساخ"
          />
          <Feature
            icon={<Clock3 />}
            title="التزام بالمواعيد"
            text="دائمًا في الموعد، في كل مرة"
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
            تواصل عبر واتساب
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
