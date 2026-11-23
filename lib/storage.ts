import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore, type Store } from "@netlify/blobs";

// Evidence screenshots.
// - STORAGE_DRIVER=netlify: Netlify Blobs. Inside Netlify the site context is automatic;
//   the GitHub Actions crawler passes BLOBS_SITE_ID + BLOBS_TOKEN (a Netlify access token).
// - otherwise: local disk under STORAGE_DIR (development and tests).

const useBlobs = () => process.env.STORAGE_DRIVER === "netlify";

let store: Store | null = null;
function blobs() {
  if (store) return store;
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  store = getStore({ name: "evidence", region: "us-east-2", consistency: "strong", ...(siteID && token ? { siteID, token } : {}) });
  return store;
}

const root = () => path.resolve(process.env.STORAGE_DIR || "./storage");
function safeJoin(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putFile(key: string, data: Buffer) {
  if (useBlobs()) {
    await blobs().set(key, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    return key;
  }
  const full = safeJoin(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

export async function getFile(key: string): Promise<Buffer> {
  if (useBlobs()) {
    const data = await blobs().get(key, { type: "arrayBuffer" });
    if (!data) throw new Error(`Not found: ${key}`);
    return Buffer.from(data);
  }
  return readFile(safeJoin(key));
}

// Removes every file under a prefix, e.g. "runs/<id>/" when a store asks to be removed.
export async function deletePrefix(prefix: string) {
  if (useBlobs()) {
    const { blobs: items } = await blobs().list({ prefix });
    await Promise.all(items.map((b) => blobs().delete(b.key)));
    return;
  }
  await rm(safeJoin(prefix.replace(/\/$/, "")), { recursive: true, force: true });
}
