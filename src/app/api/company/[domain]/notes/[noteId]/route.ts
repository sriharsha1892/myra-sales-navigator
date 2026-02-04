import { NextRequest, NextResponse } from "next/server";
import { updateNote, deleteNote } from "@/lib/supabase/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const { content, authorName, mentions } = await request.json();

    if (!content || !authorName) {
      return NextResponse.json(
        { error: "content and authorName are required" },
        { status: 400 }
      );
    }

    const note = await updateNote(noteId, content, authorName, mentions ?? []);
    if (!note) {
      return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (err) {
    console.error("PUT /api/company/[domain]/notes/[noteId] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const { authorName } = await request.json();

    if (!authorName) {
      return NextResponse.json(
        { error: "authorName is required" },
        { status: 400 }
      );
    }

    await deleteNote(noteId, authorName);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/company/[domain]/notes/[noteId] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
