import type { PrivateKeyHex } from "./private-key-hex";

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const generatePrivateKeyHex = (): PrivateKeyHex => {
  const bytes: Uint8Array = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
};
