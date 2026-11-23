import Link from "next/link";
import { signOut } from "@/app/account/actions";
import { Wordmark } from "./chrome";

export function AccountHeader({ email }: { email: string }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Wordmark />
        <nav className="nav" aria-label="Account">
          <Link href="/account">Your stores</Link>
          <span className="hide-sm muted small">{email}</span>
          <form action={signOut}><button className="btn btn-quiet btn-sm">Sign out</button></form>
        </nav>
      </div>
    </header>
  );
}
