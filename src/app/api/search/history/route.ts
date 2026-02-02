import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ history: [], message: "Search history not yet connected." });
}

export async function POST() {
  return NextResponse.json({ message: "Search history save not yet connected." });
}
