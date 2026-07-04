/**
 * Resolves the active profile for a desktop window before React hydrates.
 * Stale `default` in last-known cache must not beat a non-default Rust registry boot hint.
 */
export const resolveDesktopWindowProfileScope = (
  lastKnownProfileId: string | null | undefined,
  bootProfileId: string,
): string => {
  const cached = lastKnownProfileId?.trim() ?? "";
  const boot = bootProfileId.trim();
  if (cached && cached !== "default") {
    return cached;
  }
  if (boot && boot !== "default") {
    return boot;
  }
  return cached || boot || "default";
};
