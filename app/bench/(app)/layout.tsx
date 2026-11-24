import Link from "next/link";
import { logout } from "@/app/bench/actions";
import { BrandIcon } from "@/components/chrome";
import { requireBench } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bench", robots: { index: false } };

export default async function BenchLayout({ children }: { children: React.ReactNode }) {
  await requireBench();
  return (
    <div className="bench">
      <header className="bench-top">
        <div className="wrap">
          <Link href="/bench" className="wordmark" aria-label="QUARR Bench"><BrandIcon size={26} /> Bench</Link>
          <nav>
            <Link href="/bench">Queue</Link>
            <Link href="/bench/orders">Orders</Link>
            <Link href="/bench/checks">Checks</Link>
            <Link href="/bench/framework">Framework</Link>
            <Link href="/bench/ai">AI</Link>
            <Link href="/bench/new">New runs</Link>
            <Link href="/bench/removals">Removals</Link>
            <Link href="/bench/health">Health</Link>
            <form action={logout}><button className="btn btn-quiet btn-sm">Sign out</button></form>
          </nav>
        </div>
      </header>
      <main className="bench-main">{children}</main>
    </div>
  );
}
