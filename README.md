# QUARR — First Look platform

A founder pastes their store URL and email. QUARR walks the store the way a first-time buyer does, on a 390 px phone and a desktop screen, from the homepage through product, cart and the first checkout screen to the policies. It runs 38 deterministic checks, picks the three findings most likely to cost a first order, and sends a report in which every finding is traced to a screenshot.

There are three parts:

| Part | Where | What it is |
|---|---|---|
| **Platform** (founders) | `/`, `/s/[token]`, `/r/[token]`, `/journey`, trust pages | Landing and submission, live status, the report, the paid-journey scope page |
| **Bench** (you) | `/bench` | Review queue, the evidence-side-by-side review screen, check health and promotion, outreach runs, removal requests |
| **Engine** | `engine/` | Crawler, check library, selection, AI wording layer, promotion rules, job worker |

Screenshots of every screen are in [`docs/screenshots/`](docs/screenshots).

## The founder funnel (Notion page 07)

1. **Scan (no sign-up, about a minute).** `/` → `/scan/[token]`. A `PREVIEW` run walks the homepage, one product page, and the shipping and returns policies on a phone, with a live progress screen. The founder sees how many things a buyer may question, by area, plus **one** finding in full.
2. **Sign up** at `/signin`, with Google or a 6-digit email code (no passwords). `/account/claim/[token]` turns the preview into a `FULL` run.
3. **First findings in minutes** at `/account/runs/[id]`. Only *precision-safe* checks, or checks promoted to AUTO, are shown before review (`engine/summary.ts`). The Expert-reviewed First Look follows from the Bench by email.
4. **Buy more** from the account:
   - **Re-check credit** (₹499 + GST, proposed): a `RECHECK` run compared with the last one, showing fixed, still open and new. Findings the founder hasn't been shown are counted, never named.
   - **First-purchase journey** (₹5,000 + GST): appears in Bench → Orders.

Run kinds and who reviews them: `PREVIEW` and `RECHECK` are automated (`READY`); only `FULL` runs enter the Bench queue. The worker runs two lanes, so a preview never waits behind a full walk.

## How the engine thinks

The two governing rules come from Notion page `03 — Free First Look Engine`:

1. **A finding exists only when a deterministic check fires.** Every check returns `PASS`, `FAIL` or `NOT_OBSERVABLE`. A `FAIL` without a citation (page, screenshot, snippet) is downgraded to `NOT_OBSERVABLE`. No citation, no finding.
2. **AI writes words, never verdicts.** Claude (`engine/write.ts`) only rewrites the template copy of checks that already fired, using that check's evidence. Any AI draft that contains a number not present in the evidence is thrown away, and the deterministic template is used instead. Without an API key, the templates are used, and they are complete.

How the engine improves:

- Every Bench decision (approve, edit or drop, each with a reason code: WORDING, SEVERITY, EVIDENCE_WRONG, FALSE_POSITIVE, MISSED, UNSAFE) is stored against its check.
- A check is promoted to **AUTO** once its last 30 reviewed findings have zero EVIDENCE_WRONG, FALSE_POSITIVE or UNSAFE decisions and at most 10% SEVERITY re-ranks. Any single one of those three bad reasons demotes it.
- An UNSAFE reason suspends the check immediately.
- A report publishes without review only when every finding in it comes from an AUTO check. Its footer then says so honestly, instead of claiming a person reviewed it.

Selection (`engine/select.ts`) ranks findings by severity × evidence strength, with money-related findings weighted ×1.25. It shows at most one finding per area and one per buyer problem (for example, PRIC-02 and CHKT-02 are the same shipping-cost problem), and it never leads with Legal Metrology.

## Run it locally

```bash
cd quarr
cp .env.example .env          # set DATABASE_URL, BENCH_PASSWORD, SESSION_SECRET
npm install
npx prisma db push            # create tables
npm run build && npm start    # web app on :3000
npm run worker                # separate process: crawls run here, never in a web request
```

Bench: `http://localhost:3000/bench` (password = `BENCH_PASSWORD`).

Optional settings:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google sign-in. Redirect URI: `<APP_URL>/auth/google/callback`. Without them, only the email-code option shows.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`: payments. Point a webhook for `payment.captured` and `order.paid` at `<APP_URL>/api/pay/webhook`. For local testing without keys, `PAYMENTS_DEV=1` simulates payment.
- `GST_RATE` (default `0.18`): set it to `0` if QUARR is not GST-registered. `PRICE_JOURNEY_PAISE` and `PRICE_RECHECK_PAISE` set the prices.
- `ADMIN_EMAIL`: receives an email when a journey is paid.

- `ANTHROPIC_API_KEY`: AI wording (model `claude-opus-5-5`, low effort, server-side refusal fallback enabled).
- `RESEND_API_KEY`: real email delivery. Without it, emails are printed to the console.
- `RAZORPAY_PAYMENT_LINK`: shows a pay button on `/journey`.
- `CHROMIUM_PATH`: only if the system Chromium differs from the one playwright-core expects.

Outreach in bulk from the command line: `npm run run:once -- --file stores.txt you@quarr.in`.

## Tests

```bash
npm test
```

- **Unit tests:** selection rules, the AI number guardrail, URL safety (internal addresses are refused), rupee parsing.
- **End-to-end test:** starts two fixture stores (`fixtures/server.ts`), crawls them with a real Chromium and asserts every verdict:
  - "Kesar & Co", the good store, passes every check except HTTPS (the fixtures run over http).
  - "Glow Basics", the flawed store, fires all 30 planted problems and none of the things that are fine.

## Deploying

- **Web app:** Vercel, or any Node host. **Database:** Neon Postgres (`DATABASE_URL`).
- **Worker:** it needs Chromium and runs for minutes, so put it on Railway, Fly or Render, using the official Playwright Docker image.
- **Run the worker from an Indian region** (for example Mumbai). Geo-pricing and serviceability apps behave differently for foreign IPs, and STAT-02 (currency) would misfire.
- **Screenshots:** `lib/storage.ts` writes to local disk. Swap its two functions for Cloudflare R2 or S3 before running more than one machine.

## Known limits

- Real stores were not crawled while building this: the build sandbox blocked outbound access to store websites. Every check is proven on fixtures only. **Step 0 still applies:** run 10 real stores and compare the output with your manual First Looks before trusting any check.
- Third-party checkouts (GoKwik, Shiprocket, Razorpay Magic) open as overlays. Checkout checks will usually come back `NOT_OBSERVABLE` on those stores, which is correct but limited.
- STAT-03 (pincode persistence) is not implemented, because it would require entering a pincode, which the crawl rules forbid.
- The SSRF guard blocks private addresses by hostname and IP. Before production, also block DNS answers that resolve to private ranges (on the worker host's egress firewall).
- Not built yet: weekly monitoring (QUARR Watch), Shopify/GA4 connection, PDF export, refunds from the Bench (do them in the Razorpay dashboard, then mark them in the database).
- Google sign-in and Razorpay are written to their documented flows, but they were not exercised against the live services here (no keys in this sandbox). The email-code sign-in and test-mode payments were exercised end to end.
