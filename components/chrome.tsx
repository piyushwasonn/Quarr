import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="QUARR home">
      QUARR
    </Link>
  );
}

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className={`site-header${dark ? " dark" : ""}`}>
      <div className="wrap">
        <Wordmark />
        <nav className="nav" aria-label="Main">
          <Link href="/approach" className="hide-sm">Our approach</Link>
          <Link href="/#sample" className="hide-sm">Sample</Link>
          <Link href="/#pricing" className="hide-sm">Pricing</Link>
          <Link href="/account">Sign in</Link>
          <Link href="/#start" className="btn btn-sm btn-primary" style={dark ? { background: "#fff", color: "var(--navy-900)" } : undefined}>
            Scan my store
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="stack" style={{ ["--stack" as string]: "14px" }}>
          <Wordmark />
          <p className="tagline">See what the customer will see.</p>
          <p style={{ maxWidth: 340 }}>Every founder has blind spots. QUARR helps you find them before your customers do.</p>
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Product</p>
          <ul>
            <li><Link href="/#start">Free First Look</Link></li>
            <li><Link href="/journey">First-purchase journey</Link></li>
            <li><Link href="/#sample">Sample report</Link></li>
            <li><Link href="/approach">Our approach</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Trust</p>
          <ul>
            <li><Link href="/crawler">How our browser behaves</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
            <li><Link href="/refunds">Cancellation &amp; refunds</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li><Link href="/removal">Remove my data</Link></li>
          </ul>
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 40 }}>
        <p className="tiny muted">© {new Date().getFullYear()} QUARR. Built in India for Indian D2C brands.</p>
      </div>
    </footer>
  );
}
