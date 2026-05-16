import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderID = body.customerID;

    const apiKey = process.env.CLEANCLOUD_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: "API key missing",
      });
    }

    const response = await fetch(
      "https://cleancloudapp.com/api/getOrders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_token: apiKey,
          orderID: orderID,
        }),
      }
    );

    const data = await response.json();

    const orders = data.Orders || [];

    return NextResponse.json({
      success: true,
      orders,
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