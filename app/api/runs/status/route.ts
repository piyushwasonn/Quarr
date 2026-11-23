import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Polled by the live progress screen. Reveals only status and the current step.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const run = await db.run.findUnique({ where: { publicToken: token }, select: { status: true, progress: true, failureCode: true } });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(run, { headers: { "Cache-Control": "no-store" } });
}
