# QUARR

Next.js 15 app + Playwright crawl worker + Postgres (Prisma). See README.md for the product and architecture.

## Source of truth
Product decisions live in Notion, "QUARR — Source of Truth" (pages 01–07 and the 04 Decision Log). Any change to a name, price, promise, check rule or scope gets a row in 04.

## Rules that must not regress
- A finding exists only when a deterministic check fires, and every FAIL carries a citation (page + screenshot + snippet).
- AI (engine/write.ts) rewrites wording only; drafts that add numbers not in the evidence are discarded.
- Nothing unreviewed is named to a founder unless `isInstantSafe` allows it (engine/summary.ts). Re-checks count, but never name, findings the founder hasn't been shown.
- The crawler never pays, logs in, enters an OTP or pincode, or submits forms beyond add-to-cart.

## Commands
- `npm test` (needs Postgres-free unit tests + Chromium for the e2e fixture crawl; set CHROMIUM_PATH if the system Chromium differs)
- `npx tsc --noEmit`, `npm run build`
- Local run: `npm start` + `npm run worker` (`.env` from `.env.example`; `ALLOW_LOCAL_TARGETS=1` and `npm run fixtures` to crawl the test stores)
