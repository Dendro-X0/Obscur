"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ObscurLogo } from "./obscur-logo";
import { FEEDBACK_ISSUES_HREF, STUDIO_SERVICES_HREF } from "./site-links";

const navItems: ReadonlyArray<
  Readonly<{ label: string; href: string; external?: boolean }>
> = [
  { label: "Product", href: "/" },
  { label: "Download", href: "/download" },
  { label: "Guide", href: "/guide" },
  { label: "Scope", href: "/limitations" },
  { label: "Changelog", href: "/changelog" },
  { label: "Feedback", href: FEEDBACK_ISSUES_HREF, external: true },
  { label: "Services", href: STUDIO_SERVICES_HREF, external: true },
];

export function SiteNav() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`site-nav${open ? " is-open" : ""}`}>
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand" onClick={() => setOpen(false)}>
          <ObscurLogo size={32} priority />
          <span>Obscur</span>
        </Link>
        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="site-nav-toggle-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="site-nav-toggle-label">{open ? "Close" : "Menu"}</span>
        </button>
        <nav
          id={menuId}
          className={`site-nav-links${open ? " is-open" : ""}`}
          aria-label="Primary"
        >
          {navItems.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="site-nav-link"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="site-nav-link"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>
      <div className="site-nav-edge" aria-hidden="true" />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          Obscur ships with evidence-backed release notes, self-signed installers by default, and
          honest scope copy. Actively maintained — feedback welcome; customized services available
          through the maintainer studio.
        </p>
        <div className="site-footer-links">
          <Link href="/download">Download</Link>
          <Link href="/guide">Guide</Link>
          <Link href="/limitations">Product scope</Link>
          <a href={FEEDBACK_ISSUES_HREF} target="_blank" rel="noreferrer">
            Feedback
          </a>
          <a href={STUDIO_SERVICES_HREF} target="_blank" rel="noreferrer">
            Custom services
          </a>
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
