"use client";

const CONTACT_CARD_PREFIX = "obscur-card:";

type SearchParamReader = Readonly<{
  get: (name: string) => string | null;
}>;

const normalizeContactCardToken = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(CONTACT_CARD_PREFIX)) {
    return trimmed;
  }
  return `${CONTACT_CARD_PREFIX}${trimmed}`;
};

export const resolveDiscoveryQueryFromSearchParams = (searchParams: SearchParamReader): string | null => {
  const card = searchParams.get("card")
    ?? searchParams.get("contactCard")
    ?? searchParams.get("contact_card");
  return normalizeContactCardToken(card);
};

export const resolveDiscoveryQueryFromDeepLinkUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const fromQuery = resolveDiscoveryQueryFromSearchParams(parsed.searchParams);
    if (fromQuery) {
      return fromQuery;
    }

    if (parsed.protocol === "obscur:" && parsed.host === "contact") {
      const fromPath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      return normalizeContactCardToken(fromPath);
    }
  } catch {
    return null;
  }

  return null;
};

export const discoveryDeepLinkInternals = {
  normalizeContactCardToken,
};
