import { NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/navigator/auth";

export async function POST(request: Request) {
  const { token } = (await request.json()) as { token?: string };

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const { name } = await verifyMagicLinkToken(token);
    return NextResponse.json({ valid: true, name });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
