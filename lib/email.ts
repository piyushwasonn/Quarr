import nodemailer, { type Transporter } from "nodemailer";

// Delivery, in order of preference:
//  1. Resend (RESEND_API_KEY), once QUARR has its own domain.
//  2. SMTP, e.g. a Gmail account with an app password (SMTP_USER / SMTP_PASS).
//  3. Nothing configured: print the email, so the whole flow works in development.
let transport: Transporter | null = null;
function smtp() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    });
  }
  return transport;
}

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const from = process.env.EMAIL_FROM || "QUARR <firstlook@quarr.in>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
    return { ok: true, dev: false };
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Gmail only sends as the signed-in address, so the display name is all we choose.
    await smtp().sendMail({ from: { name: "QUARR", address: process.env.SMTP_USER }, to, subject, html, text });
    return { ok: true, dev: false };
  }
  console.log(`[email:dev] to=${to} subject="${subject}"\n${text}\n`);
  return { ok: true, dev: true };
}

export function appUrl(path = "") {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

// For the Bench health page: can we actually log in to the mail server?
export async function verifyEmailTransport(): Promise<{ ok: boolean | null; detail: string }> {
  if (process.env.RESEND_API_KEY) {
    const from = process.env.EMAIL_FROM || "";
    const domain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
    if (!domain) return { ok: false, detail: "RESEND_API_KEY is set but EMAIL_FROM isn't, e.g. QUARR <firstlook@quarr.in>." };
    try {
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
      if (r.status === 401 || r.status === 403) return { ok: null, detail: `Resend key set; sending from ${from}. (A sending-only key can't confirm the domain is verified. Check resend.com → Domains.)` };
      if (!r.ok) return { ok: false, detail: `Resend refused the key (HTTP ${r.status}).` };
      const { data } = (await r.json()) as { data?: { name: string; status: string }[] };
      const d = data?.find((x) => x.name.toLowerCase() === domain);
      if (!d) return { ok: false, detail: `${domain} isn't added in Resend yet, so emails from ${from} will be rejected.` };
      return d.status === "verified"
        ? { ok: true, detail: `Resend: ${domain} is verified; sending from ${from}.` }
        : { ok: false, detail: `Resend: ${domain} is "${d.status}". Its DNS records aren't confirmed yet, so emails from ${from} will be rejected.` };
    } catch (err) {
      return { ok: false, detail: `Couldn't reach Resend: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { ok: false, detail: "SMTP_USER / SMTP_PASS not set, so emails are only printed to the server log." };
  try {
    await smtp().verify();
    return { ok: true, detail: `Signed in to ${process.env.SMTP_HOST || "smtp.gmail.com"} as ${process.env.SMTP_USER}.` };
  } catch (err) {
    return { ok: false, detail: `Mail server refused the login: ${err instanceof Error ? err.message : String(err)}. For Gmail, use an app password, not the account password.` };
  }
}
