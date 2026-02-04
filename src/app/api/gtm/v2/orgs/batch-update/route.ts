import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { batchUpdateOrgs } from "@/lib/gtm/kv-orgs";
import { z } from "zod";
import { v2SegmentEnum } from "@/lib/gtm/v2-validation";

const batchUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        domain: z.string().optional().nullable(),
        segment: v2SegmentEnum.optional(),
        accountManager: z.string().optional().nullable(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional().nullable(),
        costUsd: z.number().min(0).optional(),
        conversations: z.number().int().min(0).optional(),
        users: z.number().int().min(0).optional(),
      })
    )
    .min(1, { message: "At least one update required" }),
});

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = batchUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await batchUpdateOrgs(parsed.data.updates);
    return NextResponse.json({ success: true, count: parsed.data.updates.length });
  } catch (err) {
    console.error("Failed to batch update orgs:", err);
    return NextResponse.json(
      { error: "Failed to batch update orgs" },
      { status: 500 }
    );
  }
}
