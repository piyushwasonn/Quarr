import { SiteFooter, SiteHeader } from "./chrome";

export function ProsePage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingTop: 56 }}>
        <article className="prose">
          <p className="eyebrow brass">{eyebrow}</p>
          <h1 style={{ marginTop: 12 }}>{title}</h1>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
