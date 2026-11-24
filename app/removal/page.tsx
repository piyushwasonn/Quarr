import { ProsePage } from "@/components/Prose";
import { RemovalForm } from "@/components/RemovalForm";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/removal", "Remove my store or data", "Ask QUARR to stop reviewing your store and to delete what it holds about it.");

export default function Removal() {
  return (
    <ProsePage eyebrow="Trust" title="Remove my data or opt out">
      <p className="lede">Tell us your store address. We&apos;ll delete any reports and screenshots for it, and refuse future First Look requests for that domain.</p>
      <RemovalForm />
    </ProsePage>
  );
}
