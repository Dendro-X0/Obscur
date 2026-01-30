import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type ParsePublicKeyInputResult =
  | Readonly<{ ok: true; publicKeyHex: PublicKeyHex; format: "hex" | "npub" }>
  | Readonly<{ ok: false; reason: "empty" | "invalid_format" | "invalid_hex" | "invalid_npub" }>;

const HEX_PUBLIC_KEY_LENGTH: number = 64;

const isHexChar = (char: string): boolean => /^[0-9a-f]$/i.test(char);

const isHexString = (value: string): boolean => {
  if (value.length === 0) {
    return false;
  }
  return Array.from(value).every((char: string): boolean => isHexChar(char));
};

const toPublicKeyHex = (value: string): PublicKeyHex => value as PublicKeyHex;

const BECH32_CHARSET: string = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const bech32Polymod = (values: ReadonlyArray<number>): number => {
  const generators: ReadonlyArray<number> = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk: number = 1;
  values.forEach((value: number): void => {
    const top: number = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    generators.forEach((gen: number, index: number): void => {
      if (((top >>> index) & 1) === 1) {
        chk ^= gen;
      }
    });
  });
  return chk;
};

const bech32HrpExpand = (hrp: string): ReadonlyArray<number> => {
  const upper: number[] = Array.from(hrp).map((char: string): number => char.charCodeAt(0) >>> 5);
  const lower: number[] = Array.from(hrp).map((char: string): number => char.charCodeAt(0) & 31);
  return [...upper, 0, ...lower];
};

const bech32VerifyChecksum = (hrp: string, data: ReadonlyArray<number>): boolean => {
  return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === 1;
};

const bech32Decode = (value: string): Readonly<{ hrp: string; data: ReadonlyArray<number> }> | null => {
  const trimmed: string = value.trim();
  const lower: string = trimmed.toLowerCase();
  if (lower.length < 8) {
    return null;
  }
  if (lower !== trimmed && trimmed.toUpperCase() !== trimmed) {
    return null;
  }
  const pos: number = lower.lastIndexOf("1");
  if (pos < 1 || pos + 7 > lower.length) {
    return null;
  }
  const hrp: string = lower.slice(0, pos);
  const dataPart: string = lower.slice(pos + 1);
  const data: number[] = [];
  for (const char of dataPart) {
    const idx: number = BECH32_CHARSET.indexOf(char);
    if (idx < 0) {
      return null;
    }
    data.push(idx);
  }
  if (!bech32VerifyChecksum(hrp, data)) {
    return null;
  }
  return { hrp, data };
};

const convertBits = (params: Readonly<{ data: ReadonlyArray<number>; from: number; to: number; pad: boolean }>): Uint8Array | null => {
  let acc: number = 0;
  let bits: number = 0;
  const ret: number[] = [];
  const maxv: number = (1 << params.to) - 1;
  for (const value of params.data) {
    if (value < 0 || value >> params.from !== 0) {
      return null;
    }
    acc = (acc << params.from) | value;
    bits += params.from;
    while (bits >= params.to) {
      bits -= params.to;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (params.pad) {
    if (bits > 0) {
      ret.push((acc << (params.to - bits)) & maxv);
    }
  } else {
    if (bits >= params.from) {
      return null;
    }
    if (((acc << (params.to - bits)) & maxv) !== 0) {
      return null;
    }
  }
  return new Uint8Array(ret);
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b: number): string => b.toString(16).padStart(2, "0"))
    .join("");
};

const decodeNpubToPublicKeyHex = (npub: string): PublicKeyHex | null => {
  const decoded: Readonly<{ hrp: string; data: ReadonlyArray<number> }> | null = bech32Decode(npub);
  if (!decoded || decoded.hrp !== "npub") {
    return null;
  }
  const payloadWithChecksum: ReadonlyArray<number> = decoded.data;
  const payload: ReadonlyArray<number> = payloadWithChecksum.slice(0, -6);
  const bytes: Uint8Array | null = convertBits({ data: payload, from: 5, to: 8, pad: false });
  if (!bytes || bytes.length !== 32) {
    return null;
  }
  const hex: string = bytesToHex(bytes);
  if (hex.length !== HEX_PUBLIC_KEY_LENGTH || !isHexString(hex)) {
    return null;
  }
  return toPublicKeyHex(hex);
};

import { nip19 } from "nostr-tools";

export const parsePublicKeyInput = (value: string): ParsePublicKeyInputResult => {
  const input: string = value.trim();
  if (input.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const lower: string = input.toLowerCase();

  // Handle nprofile
  if (lower.startsWith("nprofile")) {
    try {
      const decoded = nip19.decode(input);
      if (decoded.type === "nprofile") {
        return { ok: true, publicKeyHex: toPublicKeyHex(decoded.data.pubkey), format: "npub" };
      }
    } catch (e) {
      return { ok: false, reason: "invalid_npub" };
    }
  }

  // Handle npub
  if (lower.startsWith("npub")) {
    const decoded: PublicKeyHex | null = decodeNpubToPublicKeyHex(lower);
    if (!decoded) {
      return { ok: false, reason: "invalid_npub" };
    }
    return { ok: true, publicKeyHex: decoded, format: "npub" };
  }

  // Handle hex
  const normalizedHex: string = lower.startsWith("0x") ? lower.slice(2) : lower;
  if (normalizedHex.length !== HEX_PUBLIC_KEY_LENGTH) {
    return { ok: false, reason: "invalid_hex" };
  }
  if (!isHexString(normalizedHex)) {
    return { ok: false, reason: "invalid_hex" };
  }
  return { ok: true, publicKeyHex: toPublicKeyHex(normalizedHex), format: "hex" };
};
