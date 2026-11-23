import Link from "next/link";

/* Brand artwork from the QUARR Logo, Icon and Font Guide (public/brand/, docs/brand/).
   Never retype "QUARR" to stand in for the logo. The full logo carries the strapline,
   so small placements use the icon. Black artwork: light surfaces only. */

// eslint-disable-next-line @next/next/no-img-element
export const BrandIcon = ({ size = 30 }: { size?: number }) => <img src="/brand/quarr-icon.svg" alt="" width={Math.round((size * 139) / 131)} height={size} style={{ display: "block" }} />;

export function BrandLogo({ width = 220, alt = "QUARR — See what the customer will see" }: { width?: number; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/quarr-logo.svg" alt={alt} width={width} height={Math.round((width * 280) / 920)} style={{ display: "block", maxWidth: "100%", height: "auto" }} />;
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="wordmark" aria-label="QUARR home">
      <BrandIcon />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Wordmark />
        <nav className="nav" aria-label="Main">
          <Link href="/approach" className="hide-sm">Our approach</Link>
          <Link href="/#sample" className="hide-sm">Sample</Link>
          <Link href="/#pricing" className="hide-sm">Pricing</Link>
          <Link href="/account">Sign in</Link>
          <Link href="/#start" className="btn btn-sm btn-primary">
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
          <Link href="/" aria-label="QUARR home"><BrandLogo width={200} /></Link>
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
