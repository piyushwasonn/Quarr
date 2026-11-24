# Deploying QUARR (no domain needed)

| Piece | Runs on | Account you use |
|---|---|---|
| Website, sign-in, payments | **Netlify** | your Netlify account |
| Database | **Neon** | sign in with Google |
| Screenshots | **Netlify Blobs** (part of your Netlify site) |: |
| Crawler (walks the stores) | **GitHub Actions** in this repo | your GitHub account |
| Domain and business email | **Hostinger** | `quarr.in`, mailbox `piyush@quarr.in` |
| Email QUARR sends (codes, reports) | **Resend**, from `firstlook@quarr.in` | sign in with Google |
| Sign in with Google | **Google Cloud** | your Google account |
| Payments | **Razorpay** | your Razorpay account |

It takes about an hour. Do the steps in order, because later steps need values from earlier ones. Put keys only where this guide says: Netlify environment variables or GitHub secrets. Never put them in chat or code.

QUARR's address is **`https://quarr.in`**. This guide calls it **SITE**. The Netlify address `https://quarr.netlify.app` keeps working and redirects to it once step 2 is done.

---

## 0. Make the repository private (recommended)

The repo is public right now, so anyone can read QUARR's check library. Go to GitHub → **piyushwasonn/Quarr** → **Settings** → bottom of the page → **Change visibility** → **Private**.

A private repo gets ~2,000 free GitHub Actions minutes a month, about 600 store walks. The crawler only runs when there is work, plus one check every 3 hours.

## 1. Neon: the database

1. Go to **neon.tech**, choose **Sign up**, then **Continue with Google**.
2. Create a project:
   - **Name:** `quarr`
   - **Region:** **AWS US East 2 (Ohio)**, the same region as Netlify's functions and GitHub's runners, so every query is fast.
3. Click **Connect**, turn **Connection pooling off**, and copy the connection string (`postgresql://…neon.tech/neondb?sslmode=require`). That is your **DATABASE_URL**. The crawler creates the tables on its first run.

## 2. Domain and email: quarr.in (Hostinger)

Keep DNS at Hostinger and **add** records there. Don't move the nameservers to Netlify: your business email's records live at Hostinger, and moving would take `piyush@quarr.in` offline until they're recreated. In the Hostinger DNS editor, type only the part before `.quarr.in` in the **Name** field (Hostinger adds `.quarr.in` itself). Use `@` for `quarr.in` itself.

**A. Aliases** (free, they land in `piyush@quarr.in`). In hPanel, go to **Emails** → `quarr.in` → open the `piyush@quarr.in` account, find its aliases (or forwarders) setting, and add:
- `hello@quarr.in`: public contact (website, Razorpay, Google)
- `firstlook@quarr.in`: the sender of QUARR's automated emails, so founders' replies reach you

**B. Point quarr.in at the website:**
1. In Netlify, go to **Domain management** → **Add a domain** → `quarr.in`. Choose to keep DNS with your current provider, and make `quarr.in` the **primary** domain.
2. In Hostinger's **DNS / Nameservers** page for `quarr.in`, **delete** the existing `A` record for `@` and any `CNAME` or `A` record for `www` (Hostinger's parking page). Leave every `MX` record and the `TXT` records alone, because those run your email.
3. Add:

| Type | Name | Points to | TTL |
|---|---|---|---|
| `A` | `@` | `75.2.60.5` (Netlify's load balancer) | 3600 |
| `CNAME` | `www` | `quarr.netlify.app` | 3600 |

4. Back in Netlify, wait until the domain shows as verified, then under **HTTPS** click **Verify DNS configuration** / **Provision certificate**. That can take from a few minutes to a few hours. If Netlify shows different values in its instructions, use Netlify's.

**C. Resend: the email QUARR sends** (sign-in codes, reports, re-checks):
1. Go to **resend.com** and sign up (Google works). Go to **Domains** → **Add domain** → `quarr.in`.
2. Resend shows about three records, on the `send` and `resend._domainkey` names. Add each one in Hostinger exactly as shown, with Name = the part before `.quarr.in`. They sit on their own sub-names, so they don't touch your business email's records.
3. If Resend suggests a DMARC record (`_dmarc`), only add it if Hostinger doesn't already have one. You can't have two.
4. Click **Verify** in Resend and wait until `quarr.in` shows **Verified**.
5. Go to **API Keys** → **Create API key** with **Sending access** and copy it: that's `RESEND_API_KEY`. `EMAIL_FROM` is `QUARR <firstlook@quarr.in>`.

With Resend set up, you can skip Gmail entirely. If you've already added `SMTP_USER` and `SMTP_PASS`, leave them: Resend takes priority.

## 3. Netlify: the website

1. In Netlify, go to **Add new project** → **Import an existing project** → **GitHub**, and pick **piyushwasonn/Quarr**. The build settings come from `netlify.toml`; don't change them.
2. Your Netlify project is `quarr` (renamed from `qurr`). Once step 2B is done, SITE is `https://quarr.in`. If the address ever changes again, update `APP_URL`, the Google redirect URI and the Razorpay webhook to match.
3. Go to **Project configuration** → **Environment variables** and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | from Neon (step 1) |
| `APP_URL` | `https://quarr.in` |
| `SESSION_SECRET` | a random string of 40+ characters (password manager → generate) |
| `BENCH_PASSWORD` | a long password only you know, used for `/bench` |
| `STORAGE_DRIVER` | `netlify` |
| `RESEND_API_KEY` | from step 2C |
| `EMAIL_FROM` | `QUARR <firstlook@quarr.in>` |
| `ADMIN_EMAIL` | your own email: you're told here when a journey is paid |
| `CONTACT_EMAIL` | `hello@quarr.in` |
| `CONTACT_PHONE` | public phone or WhatsApp number (Razorpay wants one) |
| `BUSINESS_NAME` | your name or business name, exactly as on Razorpay |
| `BUSINESS_ADDRESS` | your address, as on Razorpay |
| `GST_RATE` | `0.18` if GST-registered, otherwise `0` |
| `GITHUB_DISPATCH_TOKEN` | from step 4 |

4. Go to **Deploys** → **Trigger deploy**. Open SITE, and the landing page should load.

## 4. GitHub: the crawler

**A. Let the crawler save screenshots into Netlify:**
1. In Netlify, go to **Project configuration** → **General** and copy the **Project ID**.
2. In Netlify, go to **User settings** (your avatar) → **Applications** → **Personal access tokens** → **New access token**, name it `QUARR crawler`, and copy it.

**B. Add secrets to GitHub.** Go to **piyushwasonn/Quarr** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, once for each:

| Secret | Value |
|---|---|
| `DATABASE_URL` | same as Netlify |
| `APP_URL` | same as Netlify |
| `BLOBS_SITE_ID` | the Netlify Project ID (A.1) |
| `BLOBS_TOKEN` | the Netlify access token (A.2) |
| `RESEND_API_KEY`, `EMAIL_FROM` | same as Netlify |

**C. Let the website wake the crawler:**
1. On GitHub, go to your avatar → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
   - **Name:** `QUARR wake crawler`
   - **Repository access:** Only select repositories → **Quarr**
   - **Permissions:** **Contents: Read and write** (that's what GitHub requires to start a workflow this way)
2. Copy the token into Netlify as `GITHUB_DISPATCH_TOKEN` (step 3), and redeploy.

**D. Test it.** Go to **Actions** → **Crawl queued stores** → **Run workflow**. It should finish green within about a minute. Then on SITE, scan a store. The Actions tab should show a new run, and the scan page should start moving within a minute or two.

## 5. Google sign-in

1. Go to **console.cloud.google.com** (your Google account) and create a project named **QUARR**.
2. Go to **Google Auth Platform** → **Get started**:
   - **App name:** QUARR
   - **Support email:** yours
   - **Audience:** External
   - **Contact email:** yours
3. Go to **Clients** → **Create client** → **Web application**:
   - **Authorised JavaScript origins:** SITE
   - **Authorised redirect URIs:** SITE + `/auth/google/callback`

   If Google asks for an authorised domain, enter your Netlify address without `https://` (`quarr.in`).
4. Add **Client ID** → `GOOGLE_CLIENT_ID` and **Client secret** → `GOOGLE_CLIENT_SECRET` in Netlify, then redeploy.
5. Go to **Audience** → **Publish app**. QUARR asks only for name and email, so Google doesn't need to review it.

## 6. Razorpay

Start in **Test mode** (the toggle at the top of the dashboard).

1. Go to **Account & Settings** → **API Keys** → **Generate Key**. In Netlify, set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Go to **Account & Settings** → **Webhooks** → **Add New Webhook**:
   - **URL:** SITE + `/api/pay/webhook`
   - **Secret:** a long random string. Put the same value in Netlify as `RAZORPAY_WEBHOOK_SECRET`.
   - **Events:** `payment.captured`, `order.paid`
3. Redeploy. Then sign in on SITE, open a First Look and buy a re-check with test UPI `success@razorpay`. The credit should appear right away, and the payment should show in `/bench/orders`.
4. **Going live:** Razorpay reviews the website first. It looks for the Contact, Terms, Privacy, and Cancellation & Refund pages, which the site has at `/contact`, `/terms`, `/privacy` and `/refunds`. Make sure `/contact` shows your real name, address and phone. Submit `https://quarr.in` as the website, not the `netlify.app` address. Then switch to the Live keys and add a Live webhook.

## 7. QUARR's AI: required (Claude or OpenAI)

QUARR's AI reads every store the crawler walks:
- it answers six checks a simple rule can't, such as whether two pages contradict each other, whether a first order can be low-risk, and whether a claim has support
- it double-checks every finding a rule produced before a founder can see it
- it words the findings

It can only point at words that are really on the store's pages: QUARR checks every quote, and discards copy that adds a number not in the evidence. Those checks are QUARR's own code, so they are the same whichever provider you use.

**Without a working AI, nothing is shown to a founder without your review**, quick scans show no example finding, and nothing publishes on its own.

Everything below goes in GitHub → **piyushwasonn/Quarr** → **Settings** → **Secrets and variables** → **Actions**. Keys go under **Secrets**, choices under **Variables**. They go in GitHub, not Netlify, because the reading happens in the crawler.

**A. Claude (Anthropic)**
1. Go to **console.anthropic.com**, sign in (Google works) and add billing under **Plans & billing**.
2. Go to **API keys** → **Create key**, name it `QUARR crawler`, and add it as the secret `ANTHROPIC_API_KEY`.
3. Optional variable `ANTHROPIC_MODEL`. The default is `claude-opus-5-5`; `claude-sonnet-5-5` costs about half.

**B. OpenAI**
1. Go to **platform.openai.com** → **API keys** → **Create new secret key**, name it `QUARR crawler`, and add it as the secret `OPENAI_API_KEY`. Your existing OpenAI credit pays for it.
2. Add the variable `OPENAI_MODEL` = `gpt-6.2-sol` (GPT-6.2 Sol, OpenAI's mid-tier model). `gpt-6.2-astra` is the top tier, at several times the price; worth it only if Step 0 shows Sol missing real problems. Don't use GPT-6 Luna: it's fine for wording but misses too much when checking.
3. If that model doesn't support a reasoning effort setting, also add the variable `OPENAI_REASONING` = `off`.

**C. Choose**
- **Variable `QUARR_AI_PROVIDER`** = `anthropic` or `openai`. This one decides what founders get. If you leave it out, QUARR uses Claude when its key is present, otherwise OpenAI.
- **Variable `QUARR_AI_SHADOW`** = the other one (optional). Both read every store at the same time; the shadow's answers are only recorded. **Bench → AI** then scores both against your review decisions. This doubles the AI cost while it's on, so use it for Step 0 and then remove it.

**D. Check it.** Open **Bench → Health**, press **Wake the crawler now**, and scan a store. "QUARR AI" should turn green and name the provider and model.

Approximate cost per store, at list prices:

| Model | Quick scan | Full First Look |
|---|---|---|
| Claude Opus 5.5 | about ₹12 | ₹40 to 55 |
| Claude Sonnet 5.5, or an OpenAI mid-tier model | about ₹6 | ₹20 to 25 |

OpenAI's prices aren't built into QUARR. To see real costs on Bench → AI, add `AI_PRICES` in **Netlify** (not GitHub), for example `{"your-model-id":[2,10,0.2,0]}`: US$ per million tokens for input, output, cached input and cache write, copied from OpenAI's pricing page.

## 8. Check everything: Bench → Health

Open SITE `/bench/health` and sign in with `BENCH_PASSWORD`. It tests each piece live and says what's wrong and how to fix it:

- database
- screenshot storage
- email login
- crawler wake-up, and whether queued stores are being picked up
- whether QUARR's AI ran on the last walks, which provider and model, and the last error if it didn't
- Google sign-in
- Razorpay

It never shows a secret's value. **Wake the crawler now** starts a crawl on demand.

---

## After deploy: Step 0, before telling anyone

Sign in at SITE/bench and queue 10 real Indian D2C stores at `/bench/new`. Review every run and compare it with what you'd find by hand. Drop wrong findings with the right reason code: that's how the engine learns which checks to trust.

The crawler runs from the US. A few Indian stores show other currencies or block foreign visitors. If you see that, drop those findings with reason **FALSE_POSITIVE**, and we'll look at an India-based crawler later.

## Costs

- **Netlify, Neon, Resend, Google sign-in:** free tiers are enough to start.
- **Hostinger:** your domain and business email.
- **GitHub Actions:** free (about 600 walks a month on a private repo).
- **Razorpay:** its standard fee per payment.
- **QUARR's AI:** about ₹6 to 15 per quick scan and ₹20 to 55 per full First Look, depending on the model (step 7). Double while shadow comparison is on.
