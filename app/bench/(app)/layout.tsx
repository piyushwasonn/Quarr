import Link from "next/link";
import { logout } from "@/app/bench/actions";
import { requireBench } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bench", robots: { index: false } };

export default async function BenchLayout({ children }: { children: React.ReactNode }) {
  await requireBench();
  return (
    <div className="bench">
      <header className="bench-top">
        <div className="wrap">
          <Link href="/bench" className="wordmark"><span className="mark" aria-hidden />QUARR <span style={{ fontFamily: "var(--sans)", letterSpacing: 0, fontWeight: 500, opacity: 0.6, fontSize: 13 }}>Bench</span></Link>
          <nav>
            <Link href="/bench">Queue</Link>
            <Link href="/bench/checks">Checks</Link>
            <Link href="/bench/new">New runs</Link>
            <Link href="/bench/removals">Removals</Link>
            <form action={logout}><button className="btn btn-quiet btn-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Sign out</button></form>
          </nav>
        </div>
      </header>
      <main className="bench-main">{children}</main>
    </div>
  );
}
