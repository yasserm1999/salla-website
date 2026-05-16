import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Tracker API is working",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const customerID = String(body.customerID || "").trim();

    const apiKey = process.env.CLEANCLOUD_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: "API key missing",
      });
    }

    if (!customerID) {
      return NextResponse.json({
        success: false,
        message: "Please enter a customer ID",
      });
    }

    const response = await fetch("https://cleancloudapp.com/api/getOrders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_token: apiKey,
        customerID,

      }),
    });

    const data = await response.json();

    const allOrders = Array.isArray(data?.Orders)
      ? data.Orders
      : Array.isArray(data?.orders)
      ? data.orders
      : [];

    const orders = allOrders.filter((order: any) => {
      const paid =
        order.paid === "1" ||
        order.paid === 1 ||
        order.paid === true ||
        order.payment === "1" ||
        order.payment === 1 ||
        order.payment === true;

      return !paid;
    });

return NextResponse.json({
  success: orders.length > 0,
  orders,
  message:
    orders.length > 0
      ? "Active orders found"
      : "No active orders found",
  debug: {
    totalFromCleanCloud: allOrders.length,
    activeAfterFilter: orders.length,
    firstOrder: allOrders[0] || null,
  },
});
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Server error",
      },
      { status: 500 }
    );
  }
}