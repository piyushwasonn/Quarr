import { ProsePage } from "@/components/Prose";

export const metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

// Business details come from settings so the page never shows placeholders.
export default function Contact() {
  const email = process.env.CONTACT_EMAIL || "hello@quarr.in";
  const phone = process.env.CONTACT_PHONE;
  const name = process.env.BUSINESS_NAME;
  const address = process.env.BUSINESS_ADDRESS;
  return (
    <ProsePage eyebrow="Contact" title="Talk to QUARR">
      <p className="lede">Questions about a First Look, a re-check or a journey? Write to us and a person replies, usually the same working day.</p>
      <h2>Email</h2>
      <p><a href={`mailto:${email}`}>{email}</a></p>
      {phone ? (
        <>
          <h2>Phone / WhatsApp</h2>
          <p><a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a> · Monday to Saturday, 10am to 7pm IST</p>
        </>
      ) : null}
      {name || address ? (
        <>
          <h2>Registered business</h2>
          {name ? <p>{name}</p> : null}
          {address ? <p style={{ whiteSpace: "pre-line" }}>{address}</p> : null}
        </>
      ) : null}
      <h2>Payments and refunds</h2>
      <p>See our <a href="/refunds">cancellation and refund policy</a>.</p>
    </ProsePage>
  );
}
