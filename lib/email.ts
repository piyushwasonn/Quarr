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
