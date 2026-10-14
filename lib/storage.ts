import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Local-disk evidence store. Swap for R2/S3 by keeping these three functions.
const root = () => path.resolve(process.env.STORAGE_DIR || "./storage");

function safeJoin(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putFile(key: string, data: Buffer) {
  const full = safeJoin(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

export async function getFile(key: string) {
  return readFile(safeJoin(key));
}
