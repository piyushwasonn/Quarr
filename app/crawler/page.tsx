import { ProsePage } from "@/components/Prose";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/crawler", "How our browser behaves", "QUARRBot visits a store like one careful shopper: page views and one add-to-cart, never a purchase. How to recognise it and keep it out of your analytics.");

export default function Crawler() {
  return (
    <ProsePage eyebrow="Trust" title="How our browser behaves on your store">
      <p className="lede">QUARR visits your store like one careful shopper, never like a scraper.</p>
      <h2>What it does</h2>
      <ul>
        <li>Opens your homepage, up to two product pages, the cart, and your shipping, returns, terms, privacy, contact and about pages.</li>
        <li>Adds one unit of one product to the cart, then opens the first screen of checkout and stops there.</li>
        <li>Takes screenshots on a 390 px phone screen and a 1440 px desktop screen, and reads the visible text.</li>
        <li>Checks that up to twelve links in your main menu open without errors.</li>
      </ul>
      <h2>What it never does</h2>
      <ul>
        <li>Pay, enter card or UPI details, log in, create an account, request an OTP, enter a pincode or submit any form.</li>
        <li>Visit the same store more than twice in 24 hours: one quick scan (homepage, one product, two policies) and one full walk once you sign up. Re-checks you buy are limited to one an hour.</li>
        <li>Try to get around bot protection. If your store blocks automated browsers, we stop and offer to do the review by hand.</li>
      </ul>
      <h2>How to recognise it</h2>
      <p>Its user agent contains <code>QUARRBot/0.1</code>, so you can exclude it from analytics. A full visit usually takes under two minutes and produces about twenty page views.</p>
      <h2>Opting out</h2>
      <p>If you&apos;d rather we never review your store, <a href="/removal">tell us here</a> and we&apos;ll refuse any future requests for your domain.</p>
    </ProsePage>
  );
}
