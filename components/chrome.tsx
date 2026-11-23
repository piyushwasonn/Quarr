import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="QUARR home">
      <span className="mark" aria-hidden />
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
          <Link href="/#how" className="hide-sm">How it works</Link>
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
          <p style={{ maxWidth: 340 }}>
            QUARR walks your online store the way a first-time buyer does and shows you what they trust, question or abandon, with a screenshot behind every finding.
          </p>
        </div>
        <div>
          <p className="eyebrow" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Product</p>
          <ul>
            <li><Link href="/#start">Free First Look</Link></li>
            <li><Link href="/journey">First-purchase journey</Link></li>
            <li><Link href="/#sample">Sample report</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Trust</p>
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
        <p className="tiny" style={{ color: "rgba(255,255,255,0.45)" }}>© {new Date().getFullYear()} QUARR. Built in India for Indian D2C brands.</p>
      </div>
    </footer>
  );
}
