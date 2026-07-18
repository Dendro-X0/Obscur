"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealScopeProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

/**
 * One-shot IntersectionObserver reveals for `[data-reveal]` descendants.
 * Honors prefers-reduced-motion by marking all targets visible immediately.
 */
export function RevealScope({ children, className }: RevealScopeProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      for (const el of targets) {
        el.dataset.revealVisible = "true";
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.dataset.revealVisible = "true";
          observer.unobserve(el);
        }
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    for (const el of targets) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
