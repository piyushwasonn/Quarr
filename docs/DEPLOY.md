# Deploying QUARR (no domain needed)

| Piece | Runs on | Account you use |
|---|---|---|
| Website, sign-in, payments | **Netlify** | your Netlify account |
| Database | **Neon** | sign in with Google |
| Screenshots | **Netlify Blobs** (part of your Netlify site) | — |
| Crawler (walks the stores) | **GitHub Actions** in this repo | your GitHub account |
| Email (codes, reports) | **Gmail** | a Gmail account for QUARR |
| Sign in with Google | **Google Cloud** | your Google account |
| Payments | **Razorpay** | your Razorpay account |

It takes about an hour. Do the steps in order, because later steps need values from earlier ones. Put keys only where this guide says: Netlify environment variables or GitHub secrets. Never put them in chat or code.

Your site address will be `https://<name>.netlify.app`. This guide calls it **SITE**. Try `quarr` first, e.g. `https://quarr.netlify.app`.

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

## 2. Gmail: the sender

1. Create a Gmail account for QUARR, e.g. `quarr.firstlook@gmail.com`. Any Gmail works.
2. In that account, go to **myaccount.google.com** → **Security** and turn on **2-Step Verification**.
3. Open **myaccount.google.com/apppasswords**, create an app password named `QUARR`, and copy the 16 characters.
4. **SMTP_USER** = the Gmail address. **SMTP_PASS** = the app password (not the Gmail password).

Gmail sends up to about 500 emails a day. Founders will see "QUARR <quarr.firstlook@gmail.com>". Once you own a domain, add `RESEND_API_KEY` and email switches over automatically.

## 3. Netlify: the website

1. In Netlify, go to **Add new project** → **Import an existing project** → **GitHub**, and pick **piyushwasonn/Quarr**. The build settings come from `netlify.toml`; don't change them.
2. Before the first deploy (or right after it), go to **Project configuration** → **General** → **Change project name**, and enter `quarr`. Your SITE is now `https://quarr.netlify.app`.
3. Go to **Project configuration** → **Environment variables** and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | from Neon (step 1) |
| `APP_URL` | SITE, e.g. `https://quarr.netlify.app` |
| `SESSION_SECRET` | a random string of 40+ characters (password manager → generate) |
| `BENCH_PASSWORD` | a long password only you know, used for `/bench` |
| `STORAGE_DRIVER` | `netlify` |
| `SMTP_USER`, `SMTP_PASS` | from step 2 |
| `ADMIN_EMAIL` | your own email: you're told here when a journey is paid |
| `CONTACT_EMAIL` | the QUARR Gmail from step 2 |
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
| `SMTP_USER`, `SMTP_PASS` | same as Netlify |

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

   If Google asks for an authorised domain, enter your Netlify address without `https://` (e.g. `quarr.netlify.app`).
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
4. **Going live:** Razorpay reviews the website first. It looks for the Contact, Terms, Privacy, and Cancellation & Refund pages, which the site has at `/contact`, `/terms`, `/privacy` and `/refunds`. Make sure `/contact` shows your real name, address and phone. Razorpay may ask for a custom domain rather than a `netlify.app` address. If it does, that's the moment to buy one. Then switch to the Live keys and add a Live webhook.

---

## After deploy: Step 0, before telling anyone

Sign in at SITE/bench and queue 10 real Indian D2C stores at `/bench/new`. Review every run and compare it with what you'd find by hand. Drop wrong findings with the right reason code: that's how the engine learns which checks to trust.

The crawler runs from the US. A few Indian stores show other currencies or block foreign visitors. If you see that, drop those findings with reason **FALSE_POSITIVE**, and we'll look at an India-based crawler later.

## Costs

- **Netlify, Neon, Gmail, Google sign-in:** free tiers are enough to start.
- **GitHub Actions:** free (about 600 walks a month on a private repo).
- **Razorpay:** its standard fee per payment.
- **Claude wording (optional):** only if you add `ANTHROPIC_API_KEY` to the GitHub secrets.
