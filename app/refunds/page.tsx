import { ProsePage } from "@/components/Prose";

export const metadata = { title: "Cancellation and refunds" };
export const dynamic = "force-dynamic";

export default function Refunds() {
  const email = process.env.CONTACT_EMAIL || "hello@quarr.in";
  return (
    <ProsePage eyebrow="Trust" title="Cancellation and refund policy">
      <p className="lede">QUARR sells digital services. Nothing is shipped. Here is exactly when you get your money back.</p>
      <h2>Free First Look</h2>
      <p>The scan and the First Look are free. You are never charged for them.</p>
      <h2>Re-check credits</h2>
      <ul>
        <li>Unused credits can be refunded in full within 30 days of purchase. Write to us from the email on your account.</li>
        <li>If a re-check can&apos;t walk your store (for example, bot protection blocks it), the credit goes back to your account automatically.</li>
        <li>A completed re-check uses its credit and is not refundable.</li>
      </ul>
      <h2>First-purchase journey</h2>
      <ul>
        <li>After you pay, we email you within one working day to confirm the scope.</li>
        <li>If the scope doesn&apos;t fit what you need, or you cancel before we start work, we refund you in full.</li>
        <li>Once the scope is agreed and work has started, the journey can&apos;t be cancelled. If we fail to deliver what was agreed, we refund you in full.</li>
      </ul>
      <h2>How refunds are paid</h2>
      <p>Refunds go back to the original payment method through Razorpay, usually within 5 to 7 working days of approval, depending on your bank.</p>
      <h2>Ask for a refund</h2>
      <p>Write to <a href={`mailto:${email}`}>{email}</a> with the store and the date of payment.</p>
    </ProsePage>
  );
}
