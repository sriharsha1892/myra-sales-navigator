import { NextResponse } from "next/server";
import {
  isFreshsalesAvailable,
  findOrCreateAccount,
  createFreshsalesTask,
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
    const { title, description, dueDate, accountDomain, accountName, contactId } = body;

    if (!title || !dueDate) {
      return NextResponse.json(
        { error: "title and dueDate are required" },
        { status: 400 }
      );
    }

    if (!accountDomain && !accountName) {
      return NextResponse.json(
        { error: "accountDomain or accountName required" },
        { status: 400 }
      );
    }

    // Find or create the account
    const account = await findOrCreateAccount(
      accountDomain || "",
      accountName || accountDomain || ""
    );
    if (!account) {
      return NextResponse.json(
        { error: "Failed to find or create Freshsales account" },
        { status: 500 }
      );
    }

    // Create the task — target the contact if provided, otherwise the account
    const targetableType = contactId ? "Contact" as const : "SalesAccount" as const;
    const targetableId = contactId ? parseInt(contactId, 10) : account.id;

    const result = await createFreshsalesTask({
      title,
      description,
      dueDate,
      targetableType,
      targetableId,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create task in Freshsales" },
        { status: 500 }
      );
    }

    console.log(
      `[Freshsales] Created task "${title}" (id=${result.id}) for ${targetableType} ${targetableId}`
    );

    return NextResponse.json({
      success: true,
      freshsalesTaskId: result.id,
    });
  } catch (err) {
    console.error("[Freshsales] POST /api/freshsales/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
