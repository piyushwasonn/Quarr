import { redirect } from "next/navigation";
import { LoginForm } from "@/components/bench/LoginForm";
import { isBenchSession } from "@/lib/auth";

export const metadata = { title: "Bench", robots: { index: false } };

export default async function Login() {
  if (await isBenchSession()) redirect("/bench");
  return (
    <main className="bench" style={{ display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card card-pad stack" style={{ width: "100%", maxWidth: 380 }}>
        <p className="eyebrow brass">QUARR Bench</p>
        <h1 style={{ fontSize: 26 }}>Sign in to review</h1>
        <LoginForm />
      </div>
    </main>
  );
}
