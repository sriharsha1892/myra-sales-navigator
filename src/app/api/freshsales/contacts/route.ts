import { NextResponse } from "next/server";
import {
  isFreshsalesAvailable,
  findOrCreateAccount,
  createFreshsalesContact,
} from "@/lib/navigator/providers/freshsales";

export async function POST(request: Request) {
  if (!isFreshsalesAvailable()) {
    return NextResponse.json(
      { error: "Freshsales integration not available" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      title,
      linkedinUrl,
      companyDomain,
      companyName,
    } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "firstName, lastName, and email are required" },
        { status: 400 }
      );
    }

    if (!companyDomain && !companyName) {
      return NextResponse.json(
        { error: "companyDomain or companyName required" },
        { status: 400 }
      );
    }

    // Find or create the account
    const account = await findOrCreateAccount(
      companyDomain || "",
      companyName || companyDomain || ""
    );
    if (!account) {
      return NextResponse.json(
        { error: "Failed to find or create Freshsales account" },
        { status: 500 }
      );
    }

    // Create the contact
    const result = await createFreshsalesContact(
      { firstName, lastName, email, phone, title, linkedinUrl },
      account.id
    );
    if (!result) {
      return NextResponse.json(
        { error: "Failed to create contact in Freshsales" },
        { status: 500 }
      );
    }

    console.log(
      `[Freshsales] Created contact ${firstName} ${lastName} (id=${result.id}) under account ${account.id}${account.created ? " (new account)" : ""}`
    );

    return NextResponse.json({
      success: true,
      freshsalesContactId: result.id,
      freshsalesAccountId: account.id,
      accountCreated: account.created,
    });
  } catch (err) {
    console.error("[Freshsales] POST /api/freshsales/contacts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
