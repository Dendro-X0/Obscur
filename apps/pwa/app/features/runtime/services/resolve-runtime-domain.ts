/**
 * Route-scoped runtime domains — heavy providers mount only where needed.
 * @see docs/program/obscur-product-shell-architecture-2026-05.md
 */

export type RuntimeDomain = "messaging" | "network" | "search" | "light";

const startsWithSegment = (pathname: string, prefix: string): boolean => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

export function resolveRuntimeDomain(pathnameInput: string | null | undefined): RuntimeDomain {
  const pathname = (pathnameInput ?? "/").trim() || "/";

  if (pathname === "/" || startsWithSegment(pathname, "/groups")) {
    return "messaging";
  }
  if (startsWithSegment(pathname, "/network")) {
    return "network";
  }
  if (startsWithSegment(pathname, "/search")) {
    return "search";
  }
  return "light";
}
