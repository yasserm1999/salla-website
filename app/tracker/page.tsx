"use client";

import { useState } from "react";

const steps = ["Received", "Detailing", "Cleaning", "Ready"];

export default function TrackerPage() {
  const [searchID, setSearchID] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState(0);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSearch = async () => {
    try {
      setLoading(true);
      setSearched(true);
      setMessage("");
      setOrders([]);

      const response = await fetch("/api/tracker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerID: searchID,
        }),
      });

      const data = await response.json();

      if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        setOrders(data.orders);
        setSelectedOrder(0);
      } else {
        setOrders([]);
        setMessage(data.message || "No active orders found.");
      }
    } catch (error) {
      console.error(error);
      setOrders([]);
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const order = orders[selectedOrder];

const getOrderStatus = (order: any) => {
  if (!order) return "Received";

  const status = String(order.status || "");

  // status 5 = Detailing
  if (status === "5") return "Detailing";

  // status 1 = Ready
  if (status === "1") return "Ready";

  // status 0 = Cleaning
  if (status === "0") return "Cleaning";

  // everything else
  return "Received";
};

const getStepIndex = (status: string) => {
  if (status === "Detailing") return 1;
  if (status === "Cleaning") return 2;
  if (status === "Ready") return 3;

  return 0;
};
  const getPaymentStatus = (order: any) => {
    if (!order) return "Unpaid";

    if (
      order.payment === "1" ||
      order.paid === "1" ||
      order.paid === true
    ) {
      return "Paid";
    }

    return "Unpaid";
  };

  

  return (
<main
  className="relative min-h-screen overflow-hidden px-6 py-20"
  style={{
    backgroundColor: "#c6c1bb",
    backgroundImage: "url('/pattern.png')",
    backgroundSize: "700px",
    backgroundRepeat: "repeat",
  }}
>

  <div className="relative z-10 mx-auto max-w-5xl rounded-3xl bg-white p-8 shadow-xl md:p-12">

    
        <h1 className="text-center text-4xl font-bold text-[#26364d] md:text-6xl">
          Track Your Order
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[#546d83]">
          Enter your customer ID to view and track your orders.
        </p>

        <div className="mt-10 flex flex-col gap-4 md:flex-row">
          <input
            value={searchID}
            onChange={(e) => setSearchID(e.target.value)}
            placeholder="Example: 1"
            className="flex-1 rounded-2xl border border-[#d8e1e7] px-5 py-4 outline-none focus:border-[#546d83]"
          />

          <button
            onClick={handleSearch}
            className="rounded-2xl bg-[#26364d] px-8 py-4 font-semibold text-white hover:bg-[#546d83]"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {searched && orders.length > 0 && (
          <div className="mt-10">
            {orders.length > 1 && (
              <div className="mb-8">
                <label className="mb-2 block font-semibold text-[#26364d]">
                  Select Order
                </label>

                <select
                  value={selectedOrder}
                  onChange={(e) => setSelectedOrder(Number(e.target.value))}
                  className="w-full rounded-2xl border border-[#d8e1e7] bg-white px-5 py-4 outline-none focus:border-[#546d83]"
                >
                  {orders.map((order, index) => (
                    <option key={order.id || index} value={index}>
                      #{order.id || index + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-3xl bg-[#f5f3f0] p-6">
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-[#546d83]">Order ID</p>
                  <p className="text-xl font-bold text-[#26364d]">
                    #{order?.id || "N/A"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#546d83]">Payment Status</p>
                  <p className="text-xl font-bold text-[#26364d]">
                    {getPaymentStatus(order)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#546d83]">Current Status</p>
                  <p className="text-xl font-bold text-[#26364d]">
                    {getOrderStatus(order)}
                  </p>


                </div>
              </div>



<div className="relative mt-10 px-4">
  <div className="absolute left-[12.5%] right-[12.5%] top-[22px] h-1 rounded-full bg-white" />

  <div
    className="absolute left-[12.5%] top-[22px] h-1 rounded-full bg-[#26364d]"
    style={{
      width: `${(getStepIndex(getOrderStatus(order)) / (steps.length - 1)) * 75}%`,
    }}
  />

  <div className="relative grid grid-cols-4 gap-2">
    {steps.map((step, index) => {
      const completed = index <= getStepIndex(getOrderStatus(order));

      return (
        <div key={step} className="flex flex-col items-center">
          <div
            className={`z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 text-sm font-bold ${
              completed
                ? "border-[#26364d] bg-[#26364d] text-white"
                : "border-white bg-[#d8e1e7] text-[#9aa5af]"
            }`}
          >
            {index + 1}
          </div>

          <p
            className={`mt-3 text-center text-xs font-semibold md:text-sm ${
              completed ? "text-[#26364d]" : "text-[#9aa5af]"
            }`}
          >
            {step}
          </p>
        </div>
      );
    })}
  </div>
</div>
            </div>
          </div>
        )}

        {searched && !loading && orders.length === 0 && (
          <div className="mt-8 rounded-2xl bg-red-50 p-5 text-center font-semibold text-red-700">
            {message || "No active orders found."}
          </div>
        )}
      </div>
    </main>
  );
}