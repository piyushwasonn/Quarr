import { NextResponse } from "next/server";
import { isBenchSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getFile } from "@/lib/storage";

// Evidence screenshots. Visible to the Bench; to the signed-in owner of the run;
// for a finished anonymous preview; and for published reports. Sample images are public.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  if (!/^(runs\/[a-z0-9]+\/[a-z0-9_]+-(mobile|desktop)\.jpg|sample\/[a-z0-9_-]+\.jpg)$/.test(path)) return new NextResponse("Not found", { status: 404 });

  if (path.startsWith("runs/")) {
    const run = await db.run.findUnique({ where: { id: key[1] }, select: { status: true, kind: true, userId: true } });
    if (!run) return new NextResponse("Not found", { status: 404 });
    const open = ["PUBLISHED", "DELIVERED"].includes(run.status) || (run.kind === "PREVIEW" && run.status === "READY");
    if (!open && !(await isBenchSession())) {
      const user = await currentUser();
      if (!user || user.id !== run.userId) return new NextResponse("Not found", { status: 404 });
    }
  }
  try {
    const file = path.startsWith("sample/") ? await import("node:fs/promises").then((fs) => fs.readFile(`${process.cwd()}/public/${path}`)) : await getFile(path);
    return new NextResponse(new Uint8Array(file), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
