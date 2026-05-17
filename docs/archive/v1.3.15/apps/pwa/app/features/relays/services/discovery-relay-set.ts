"use client";

export const GLOBAL_DISCOVERY_RELAY_URLS: ReadonlyArray<string> = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
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

