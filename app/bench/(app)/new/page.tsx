import { QueueForm } from "@/components/bench/QueueForm";

export default function NewRuns() {
  return (
    <div className="stack" style={{ ["--stack" as string]: "16px" }}>
      <h1>Queue outreach runs</h1>
      <p className="muted small" style={{ maxWidth: 720 }}>
        For stores you want to approach. The worker walks each one, you review it here, and publishing gives you a private report link to send in your message. Nothing is emailed to the store automatically. Never imply the owner asked for it, and delete it if they ask.
      </p>
      <QueueForm />
    </div>
  );
}
