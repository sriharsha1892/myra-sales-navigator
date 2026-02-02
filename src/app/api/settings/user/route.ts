import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ settings: null, message: "User settings not yet connected." });
}

export async function PUT() {
  return NextResponse.json({ message: "User settings update not yet connected." });
}
