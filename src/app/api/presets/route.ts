import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ presets: [], message: "Presets not yet connected." });
}

export async function POST() {
  return NextResponse.json({ message: "Preset creation not yet connected." });
}

export async function DELETE() {
  return NextResponse.json({ message: "Preset deletion not yet connected." });
}
