import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const metadata = await req.json();

  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Pinata API keys not configured on server" },
      { status: 500 },
    );
  }

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `decimoon-invoice-${metadata.title}-${Date.now()}`,
        },
        pinataOptions: { cidVersion: 1 },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Pinata error: ${error}` },
      { status: 502 },
    );
  }

  const data = await response.json();
  return NextResponse.json({ cid: data.IpfsHash });
}
