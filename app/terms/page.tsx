import { ProsePage } from "@/components/Prose";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <ProsePage eyebrow="Trust" title="Terms of use">
      <h2>The free First Look</h2>
      <p>The First Look is a free, automated review of the public pages of an online store, checked by a person before it is sent. Request one only for a store you own or work on.</p>
      <h2>What a finding is, and isn&apos;t</h2>
      <p>Findings describe what we observed and how a buyer is likely to respond. They are an informed opinion based on evidence, not a guarantee of results, and they are not legal, tax or compliance advice.</p>
      <h2>Fair use</h2>
      <p>One First Look per store per day, and a small number per person per day. We may decline requests that look automated or abusive.</p>
      <h2>Paid journeys</h2>
      <p>Paid work is scoped and agreed with you by email before payment. The agreed scope and these terms together form our agreement.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, our liability for the free service is limited to zero, and for paid work to the amount you paid for it.</p>
    </ProsePage>
  );
}
