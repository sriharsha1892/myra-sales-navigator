import { NextRequest, NextResponse } from "next/server";
import { getNotesForCompany, addNote } from "@/lib/supabase/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const notes = await getNotesForCompany(domain);
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("GET /api/company/[domain]/notes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { content, authorName, mentions } = await request.json();

    if (!content || !authorName) {
      return NextResponse.json(
        { error: "content and authorName are required" },
        { status: 400 }
      );
    }

    const note = await addNote(domain, content, authorName, mentions ?? []);
    if (!note) {
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (err) {
    console.error("POST /api/company/[domain]/notes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
