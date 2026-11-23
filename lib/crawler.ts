// Wakes the crawler (a GitHub Actions workflow) when a run is queued.
// Without GITHUB_DISPATCH_TOKEN (local development) the long-running worker picks runs up instead.
export async function wakeCrawler(reason: string) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_CRAWLER_REPO || "piyushwasonn/quarr";
  if (!token) return;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "crawl", client_payload: { reason } }),
    });
    if (!res.ok) console.error(`[crawler] dispatch failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    // The scheduled safety-net run will still pick the work up.
    console.error("[crawler] dispatch error", err);
  }
}
