import { NextResponse } from "next/server";

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
        message: "Please enter customer ID",
      });
    }

    const response = await fetch("https://cleancloudapp.com/api/getCustomer", {
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

    const customer = data?.Customer || data?.customer || data;

    const pointsAvailable =
      customer?.loyaltyPointsAvailable ??
      customer?.unusedLoyaltyPoints ??
      customer?.loyaltyPoints ??
      customer?.points ??
      "0";

    const pointsUsed = customer?.loyaltyPointsUsed ?? "0";

    const creditAvailable = customer?.creditAvailable ?? "0.00";

    return NextResponse.json({
      success: true,
      customer,
      pointsAvailable,
      pointsUsed,
      creditAvailable,
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