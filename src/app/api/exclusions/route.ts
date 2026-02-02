import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ exclusions: [], message: "Using mock data." });
}

export async function POST() {
  return NextResponse.json({ message: "Exclusion CRUD not yet connected." });
}

export async function DELETE() {
  return NextResponse.json({ message: "Exclusion delete not yet connected." });
}
