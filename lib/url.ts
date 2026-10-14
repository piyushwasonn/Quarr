// Turn whatever a founder pastes into a crawlable origin.
export function normalizeStoreUrl(input: string): { url: string; domain: string } | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  const allowLocal = process.env.ALLOW_LOCAL_TARGETS === "1";
  if (!allowLocal && !isPublicHostname(host)) return null;
  const domain = host.replace(/^www\./, "");
  return { url: `${parsed.protocol}//${parsed.host}/`, domain };
}

// The crawler must never be pointed at internal infrastructure.
function isPublicHostname(host: string) {
  if (!host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (host.startsWith("[")) return false;
  return true;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.length <= 254;
}
