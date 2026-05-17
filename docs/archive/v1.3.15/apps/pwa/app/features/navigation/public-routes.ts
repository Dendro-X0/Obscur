export const getPublicProfileHref = (pubkey: string): string => {
  const params = new URLSearchParams();
  params.set("pubkey", pubkey);
  return `/network/profile?${params.toString()}`;
};

export const getPublicGroupHref = (groupId: string, relayUrl?: string): string => {
  const params = new URLSearchParams();
  params.set("id", groupId);
  if (relayUrl) {
    params.set("relay", relayUrl);
  }
  return `/groups/view?${params.toString()}`;
};

export const toAbsoluteAppUrl = (path: string, origin?: string): string => {
  const baseOrigin = origin
    || (typeof window !== "undefined" ? window.location.origin : "https://obscur.app");
  return new URL(path, baseOrigin).toString();
};
