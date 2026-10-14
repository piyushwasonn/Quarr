import { NextResponse } from "next/server";
import { isBenchSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFile } from "@/lib/storage";

// Evidence screenshots. Visible to the Bench always; to everyone else only
// once the report they belong to has been published. Sample images are public.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  if (!/^(runs\/[a-z0-9]+\/[a-z0-9_]+-(mobile|desktop)\.jpg|sample\/[a-z0-9_-]+\.jpg)$/.test(path)) return new NextResponse("Not found", { status: 404 });

  if (path.startsWith("runs/")) {
    const runId = key[1];
    const bench = await isBenchSession();
    if (!bench) {
      const run = await db.run.findUnique({ where: { id: runId }, select: { status: true } });
      if (!run || !["PUBLISHED", "DELIVERED"].includes(run.status)) return new NextResponse("Not found", { status: 404 });
    }
  }
  try {
    const file = path.startsWith("sample/") ? await import("node:fs/promises").then((fs) => fs.readFile(`${process.cwd()}/public/${path}`)) : await getFile(path);
    return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
