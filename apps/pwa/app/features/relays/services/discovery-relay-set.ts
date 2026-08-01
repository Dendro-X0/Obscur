"use client";

export const GLOBAL_DISCOVERY_RELAY_URLS: ReadonlyArray<string> = [
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
];

export const mergeRelaySets = (
  primaryRelayUrls: ReadonlyArray<string>,
  secondaryRelayUrls: ReadonlyArray<string>
): ReadonlyArray<string> => {
  return Array.from(new Set([
    ...primaryRelayUrls.map((url) => url.trim()).filter((url) => url.length > 0),
    ...secondaryRelayUrls.map((url) => url.trim()).filter((url) => url.length > 0),
  ]));
};

