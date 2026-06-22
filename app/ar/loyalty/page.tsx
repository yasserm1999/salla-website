"use client";

import { useState } from "react";
import { Gift, Search, Sparkles, Wallet } from "lucide-react";

export default function LoyaltyPageAr() {
  const [customerID, setCustomerID] = useState("");
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const checkPoints = async () => {
    setLoading(true);
    setMessage("");
    setData(null);

    const res = await fetch("/api/loyalty", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customerID }),
    });

    const result = await res.json();

    setLoading(false);

    if (!result.success) {
      setMessage(result.message || "تعذّر العثور على تفاصيل الولاء");
      return;
    }

    setData(result);
  };

  const pointsAvailable = Number(data?.pointsAvailable || 0);
  const pointsUsed = Number(data?.pointsUsed || 0);
  const creditAvailable = Number(data?.creditAvailable || 0);

  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-screen px-4 py-16 md:px-6 md:py-20"
      style={{
        backgroundColor: "#c6c1bb",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "760px",
        backgroundRepeat: "repeat",
      }}
    >
      <div className="mx-auto max-w-5xl rounded-[34px] bg-white/90 p-6 text-center shadow-2xl backdrop-blur md:p-12">
        <Gift className="mx-auto text-[#d8b98a]" size={52} />

        <h1 className="mt-5 text-4xl font-bold text-[#26364d] md:text-6xl">
          ولاء سلَّة
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-[#546d83] md:text-lg">
          أدخل رقم العميل لعرض نقاط الولاء والرصيد المتاح.
        </p>

        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <input
            value={customerID}
            onChange={(e) => setCustomerID(e.target.value)}
            placeholder="أدخل رقم العميل"
            className="flex-1 rounded-2xl border border-[#d8e1e7] px-5 py-4 text-[#26364d] outline-none focus:border-[#26364d]"
          />

          <button
            onClick={checkPoints}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#26364d] px-7 py-4 font-semibold text-white transition hover:scale-105"
          >
            <Search size={20} />
            {loading ? "جارٍ التحقّق..." : "تحقّق"}
          </button>
        </div>

        {data && (
          <div className="mt-10 rounded-[30px] bg-[#26364d] p-6 text-white shadow-xl md:p-8">
            <Sparkles className="mx-auto text-[#d8b98a]" size={42} />

            <p className="mt-4 text-sm text-[#d8b98a]">
              النقاط المتاحة
            </p>

            <h2 className="mt-3 text-6xl font-bold">{pointsAvailable}</h2>

            <p className="mt-3 text-lg text-white/75">
              القيمة التقريبية للنقاط: ر.ع. {(pointsAvailable * 0.05).toFixed(2)}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-xs text-[#d8b98a]">
                  النقاط المستخدمة
                </p>
                <p className="mt-2 text-3xl font-bold">{pointsUsed}</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-xs text-[#d8b98a]">
                  القيمة المستخدمة
                </p>
                <p className="mt-2 text-3xl font-bold">
                  ر.ع. {(pointsUsed * 0.05).toFixed(2)}
                </p>
              </div>

              <div className="rounded-2xl bg-[#d8b98a] p-5 text-[#26364d]">
                <Wallet className="mx-auto" size={28} />
                <p className="mt-2 text-xs">
                  الرصيد المتاح
                </p>
                <p className="mt-2 text-3xl font-bold">
                  ر.ع. {creditAvailable.toFixed(2)}
                </p>
              </div>
            </div>

            <p className="mt-8 text-white/75">
              شكراً لاختياركم سلَّة.
            </p>
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-2xl bg-red-50 px-5 py-4 font-semibold text-red-600">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
