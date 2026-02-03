import { NextRequest, NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/gtm-dashboard/queries";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { pinSchema } from "@/lib/gtm-dashboard/validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const pin = await getConfig("pin");
    const pinStr = typeof pin === "string" ? pin.replace(/"/g, "") : "";
    return NextResponse.json({ pin: pinStr });
  } catch {
    return NextResponse.json({ error: "Failed to get PIN" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = pinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    await setConfig("pin", parsed.data.pin);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update PIN" },
      { status: 500 }
    );
  }
}
