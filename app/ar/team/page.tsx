import { Award, Shirt, Sparkles, Users } from "lucide-react";

const team = [
  {
    name: "كومار",
    role: "أخصائي عناية بالملابس أول",
    experience: "سنوات من الخبرة",
    skills: ["فحص الأقمشة", "عناية متميّزة بالملابس", "تشطيب احترافي"],
    image: "/team-kumar.jpg",
  },
  {
    name: "ساني",
    role: "أخصائي عمليات التنظيف",
    experience: "سنوات من الخبرة",
    skills: ["التنظيف الرطب", "دعم التنظيف الجاف", "مناولة الملابس"],
    image: "/team-sunny.jpg",
  },
  {
    name: "سونو",
    role: "أخصائي الكي والتشطيب",
    experience: "سنوات من الخبرة",
    skills: ["الكي", "تشطيب التفاصيل", "عناية بالجودة"],
    image: "/team-sonu.jpg",
  },
  {
    name: "سانجو",
    role: "أخصائي مراقبة الجودة",
    experience: "سنوات من الخبرة",
    skills: ["الفحص النهائي", "دقة الطلبات", "رعاية العملاء"],
    image: "/team-sanju.jpg",
  },
];

export default function TeamPageAr() {
  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-screen px-4 py-14 md:px-6 md:py-20"
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
            تعرّف على فريقنا
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#546d83] md:text-lg md:leading-8">
            الأشخاص الذين يقفون خلف معايير الجودة والعناية الاحترافية والتشطيب
            الموثوق في سلَّة.
          </p>
        </div>

        <div className="mt-10 grid gap-4 rounded-[30px] bg-[#26364d]/95 p-5 text-white shadow-2xl md:grid-cols-3 md:p-8">
          <Stat icon={<Users />} title="4 أعضاء في الفريق" />
          <Stat icon={<Award />} title="عناية احترافية" />
          <Stat icon={<Sparkles />} title="تركيز على الجودة" />
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {team.map((member) => (
            <div
              key={member.name}
              className="overflow-hidden rounded-[32px] bg-white/92 shadow-2xl backdrop-blur transition hover:-translate-y-1"
            >
              <div className="h-80 overflow-hidden bg-[#26364d]/10">
                <img
                  src={member.image}
                  alt={member.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-6">
                <h2 className="text-3xl font-bold text-[#26364d]">
                  {member.name}
                </h2>

                <p className="mt-2 font-semibold text-[#546d83]">
                  {member.role}
                </p>

                <div className="mt-4 inline-flex rounded-full bg-[#e8f0f4] px-4 py-2 text-sm font-semibold text-[#26364d]">
                  {member.experience}
                </div>

                <div className="mt-5 space-y-3">
                  {member.skills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-3 text-[#3f4f61]"
                    >
                      <Shirt size={17} className="text-[#546d83]" />
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stat({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/10 px-5 py-4">
      <div className="text-[#d8b98a]">{icon}</div>
      <p className="font-semibold">{title}</p>
    </div>
  );
}
