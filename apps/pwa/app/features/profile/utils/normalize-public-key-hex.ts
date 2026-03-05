import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { parsePublicKeyInput } from "./parse-public-key-input";

export const normalizePublicKeyHex = (value: string | null | undefined): PublicKeyHex | null => {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = parsePublicKeyInput(value);
  if (!parsed.ok) {
    return null;
  }
  return parsed.publicKeyHex;
};

export const normalizePublicKeyHexList = (
  values: ReadonlyArray<string | PublicKeyHex>,
): ReadonlyArray<PublicKeyHex> => {
  const deduped = new Set<PublicKeyHex>();
  for (const value of values) {
    const normalized = normalizePublicKeyHex(value);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Array.from(deduped);
};
