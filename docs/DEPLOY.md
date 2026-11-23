# Deploying QUARR

Total time: about an hour. Do the steps in this order, because later steps need earlier values (for example, Google needs your live URL).

| # | Service | What you get | Needs |
|---|---|---|---|
| 1 | Domain | `quarr.in` (or whatever you own) | — |
| 2 | Neon | `DATABASE_URL` | Google sign-in |
| 3 | Railway | The live app (web + crawler) at your domain | GitHub, card |
| 4 | Resend | Email delivery from your domain | DNS access |
| 5 | Google Cloud | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Live URL from step 3 |
| 6 | Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Live URL from step 3 |

Never paste keys into chat, email or code. Put them only in Railway's **Variables** tab.

---

## 1. Domain

You need a domain you control (DNS access) for Resend and for a professional sign-in screen. If you don't own one yet, buy it first (GoDaddy, Namecheap, Cloudflare). Everything below assumes `quarr.in`. Replace it with yours.

## 2. Neon (database)

1. Go to **neon.tech**, then **Sign up** and choose **Continue with Google**.
2. Create a project:
   - **Name:** `quarr`
   - **Region:** **AWS Asia Pacific (Singapore)**, the closest to India
   - Leave the Postgres version at its default.
3. On the project dashboard, click **Connect**.
4. Turn **Connection pooling off** and copy the connection string. It looks like `postgresql://…@ep-….ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
5. That string is your `DATABASE_URL`. Keep it for step 3. The app creates its own tables when it first starts.

## 3. Railway (hosting the app and the crawler)

1. Go to **railway.com**, then **Login with GitHub**.
2. Click **New Project**, then **Deploy from GitHub repo**, then pick **piyushwasonn/Quarr**. Railway finds the `Dockerfile` by itself.
3. Open the service, go to **Settings**, then:
   - **Region:** Southeast Asia (Singapore)
   - **Networking:** click **Generate Domain** for now. Later, add **Custom Domain** `quarr.in` and create the CNAME it shows at your domain registrar.
4. Go to **Volumes**, then **Add volume** with **Mount path** `/data`. This is where screenshots live.
5. Go to **Variables** and add the following (values for steps 4–6 come later; the app runs without them):

| Variable | Value |
|---|---|
| `DATABASE_URL` | from Neon (step 2) |
| `APP_URL` | `https://quarr.in` (or the Railway domain until the custom domain works) |
| `SESSION_SECRET` | a random string of 40+ characters (use a password manager's generator) |
| `BENCH_PASSWORD` | a long password only you know, used for `/bench` |
| `ADMIN_EMAIL` | your email: you're told here when a journey is paid |
| `CONTACT_EMAIL` | the public support email, e.g. `hello@quarr.in` |
| `CONTACT_PHONE` | public phone or WhatsApp number (Razorpay wants one) |
| `BUSINESS_NAME` | your legal business name, as on your Razorpay account |
| `BUSINESS_ADDRESS` | your registered address |
| `GST_RATE` | `0.18` if GST-registered, otherwise `0` |
| `EMAIL_FROM` | `QUARR <firstlook@quarr.in>` |

6. Deploy. Open `https://<your-domain>/`, and the landing page should load. Sign in at `/bench` with your `BENCH_PASSWORD`.

**Note on location:** Railway's closest region is Singapore. A few Indian stores use apps that change prices or currency for foreign visitors, so the currency check (STAT-02) can misfire. If you see that in the Bench, drop those findings with reason FALSE_POSITIVE, and we'll move the crawler to an Indian region.

## 4. Resend (email)

Sign-in codes and reports are sent by email, so this step is required before anyone else can sign up.

1. Go to **resend.com**, then **Domains**, then **Add Domain**, and enter `quarr.in`.
2. Add the DNS records Resend shows (SPF, DKIM, and optionally DMARC) at your domain registrar. Click **Verify**. It can take a few minutes to an hour.
3. Go to **API Keys**, then **Create API Key**, with permission **Sending access**.
4. In Railway → Variables, add `RESEND_API_KEY`.

Until the domain is verified, Resend only delivers to your own Resend login email, so founders won't receive their codes.

## 5. Google sign-in

1. Go to **console.cloud.google.com** and sign in with your Google account. Create a project called **QUARR** from the top-left project picker.
2. Go to **Google Auth Platform** (APIs & Services → OAuth consent screen), then **Get started**:
   - **App name:** QUARR
   - **User support email:** yours
   - **Audience:** External
   - **Contact email:** yours
3. Go to **Branding** and add your logo (optional), plus your homepage `https://quarr.in`, privacy policy `https://quarr.in/privacy` and terms `https://quarr.in/terms`. Add `quarr.in` under **Authorised domains**.
4. Go to **Clients**, then **Create client**:
   - **Application type:** Web application
   - **Name:** QUARR web
   - **Authorised JavaScript origins:** `https://quarr.in`
   - **Authorised redirect URIs:** `https://quarr.in/auth/google/callback`
5. Copy the **Client ID** and **Client secret** into Railway as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Go to **Audience**, then **Publish app**. QUARR only asks for name and email (basic scopes), so Google doesn't require a review. If you skip this, only test users you list can sign in.

## 6. Razorpay

Start in **Test mode** (top of the dashboard), check everything works, then repeat with Live keys.

1. Go to **Account & Settings**, then **API Keys**, then **Generate Key**. Copy the **Key Id** and **Key Secret** into Railway as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Go to **Account & Settings**, then **Webhooks**, then **Add New Webhook**:
   - **URL:** `https://quarr.in/api/pay/webhook`
   - **Secret:** make up a long random string, and put the same value in Railway as `RAZORPAY_WEBHOOK_SECRET`
   - **Events:** `payment.captured` and `order.paid`
3. Test: sign in on the live site, open your First Look, and buy a re-check. Use Razorpay's test UPI ID `success@razorpay` or a test card. Your credit should appear immediately, and the payment should show in `/bench/orders`.
4. **Going live:** Razorpay checks your website before activating live payments. The site already has the pages it looks for: Contact (`/contact`), Terms (`/terms`), Privacy (`/privacy`), and Cancellation & refunds (`/refunds`). Make sure `BUSINESS_NAME`, `BUSINESS_ADDRESS` and `CONTACT_PHONE` are filled in, so `/contact` shows real details. Once activated, swap in the Live keys and the Live webhook.

---

## After deploy: Step 0 before announcing anything

Queue 10 real Indian D2C stores at `/bench/new`. Review each run in the Bench, and compare it with what you'd find by hand. Drop wrong findings with the right reason code: that's how the engine learns which checks to trust. Only then share the link publicly.
