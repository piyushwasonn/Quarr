import { ProsePage } from "@/components/Prose";

export const metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

export default function Privacy() {
  const contact = process.env.CONTACT_EMAIL || "hello@quarr.in";
  return (
    <ProsePage eyebrow="Trust" title="Privacy">
      <p className="lede">We collect as little as we can, and we tell you exactly what and why. This notice is written for India&apos;s Digital Personal Data Protection Act, 2023.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Your email address</strong>, to send you your First Look and to reply if you write back.</li>
        <li><strong>Your store address</strong>, and what our browser sees on your public store pages: screenshots and visible text.</li>
        <li><strong>A one-way hash of your IP address</strong>, only to limit abuse of the free service. We never store the IP address itself.</li>
      </ul>
      <h2>What we do with it</h2>
      <p>We use it to prepare and deliver your First Look, to keep the service from being abused, and to improve how QUARR&apos;s checks work. We do not sell it, and we do not add you to marketing emails unless you ask.</p>
      <h2>Who else processes it</h2>
      <p>Our hosting and database providers, our email delivery provider, and AI providers (Anthropic, and OpenAI where we use or compare it) that read the pages we captured from the store to check and word findings. They receive the store&apos;s public page text and screenshots, never your email.</p>
      <h2>How long we keep it</h2>
      <p>Reports and evidence are kept for 12 months so you can come back to them, then deleted. You can ask us to delete them sooner.</p>
      <h2>Your rights</h2>
      <p>You can ask to see, correct or erase your data, or withdraw consent, at any time by writing to <a href={`mailto:${contact}`}>{contact}</a> or through the <a href="/removal">removal page</a>. You also have the right to raise a grievance with us and, after that, with the Data Protection Board of India.</p>
    </ProsePage>
  );
}
