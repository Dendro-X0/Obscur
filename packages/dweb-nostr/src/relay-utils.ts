/**
 * Standardizes relay URL normalization across the project.
 * Removes trailing slashes, converts to lowercase, and trims whitespace.
 */
export const normalizeRelayUrl = (url: string | null | undefined): string => {
  const trimmed = url?.trim() ?? "";
  if (trimmed.length === 0) return "unknown";
  
  // Basic protocol check
  if (!/^wss?:\/\/.+/.test(trimmed)) {
    // If it's a known sentinal or just invalid, return as-is but trimmed
    return trimmed.toLowerCase();
  }

  try {
    const urlObj = new URL(trimmed.toLowerCase());
    // Remove trailing slash from pathname if it's just "/"
    const normalized = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname === '/' ? '' : urlObj.pathname}`;
    return normalized;
  } catch {
    // Fallback to simple string manipulation if URL parsing fails
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
};

/**
 * Validates if a string is a properly formatted relay URL.
 */
export const isValidRelayUrl = (url: string | null | undefined): boolean => {
  const normalized = normalizeRelayUrl(url);
  if (normalized === "unknown") return false;
  return /^wss?:\/\/.+/.test(normalized);
};
