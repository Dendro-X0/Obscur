import Link from "next/link";
import { ObscurLogo } from "./obscur-logo";

const navItems: ReadonlyArray<
  Readonly<{ label: string; href: string; external?: boolean }>
> = [
  { label: "Product", href: "/" },
  { label: "Download", href: "/download" },
  { label: "Limitations", href: "/limitations" },
  { label: "Changelog", href: "/changelog" },
  {
    label: "Docs",
    href: "https://github.com/Dendro-X0/Obscur/tree/main/docs",
    external: true,
  },
];

export function SiteNav() {
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand">
          <ObscurLogo size={32} priority />
          <span>Obscur</span>
        </Link>
        <nav className="site-nav-links" aria-label="Primary">
          {navItems.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="site-nav-link"
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="site-nav-link">
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          Obscur ships with evidence-backed release notes, unsigned installers by default, and
          honest scope copy.
        </p>
        <div className="site-footer-links">
          <Link href="/download">Download</Link>
          <Link href="/limitations">Known limitations</Link>
          <a
            href="https://github.com/Dendro-X0/Obscur/blob/main/docs/program/obscur-v2-phase3-signing-policy.md"
            target="_blank"
            rel="noreferrer"
          >
            Signing policy
          </a>
          <a
            href="https://github.com/Dendro-X0/Obscur/blob/main/docs/program/obscur-v2-install-build-guide.md"
            target="_blank"
            rel="noreferrer"
          >
            Build from source
          </a>
        </div>
      </div>
    </footer>
  );
}
