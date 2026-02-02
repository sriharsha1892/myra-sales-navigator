import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    message: "CSV export not yet connected.",
  });
}
