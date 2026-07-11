import type { EncryptedString } from "./encrypted-string";
import {
  DEFAULT_ARGON2ID_KDF_PARAMS,
  IDENTITY_ARGON2ID_ALG,
  IDENTITY_PBKDF2_ALG,
  type Argon2idKdfParams,
} from "./argon2id-kdf";
import type { IdentityEnvelopeKdf } from "./identity-envelope-kdf";

export type ParsedIdentityEnvelope = Readonly<{
  v: number;
  kdf: IdentityEnvelopeKdf;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const parseArgon2Params = (parsed: Record<string, unknown>): Argon2idKdfParams => {
  const m = typeof parsed.m === "number" ? parsed.m : DEFAULT_ARGON2ID_KDF_PARAMS.m;
  const t = typeof parsed.t === "number" ? parsed.t : DEFAULT_ARGON2ID_KDF_PARAMS.t;
  const p = typeof parsed.p === "number" ? parsed.p : DEFAULT_ARGON2ID_KDF_PARAMS.p;
  return { m, t, p };
};

export const parseIdentityEnvelope = (value: EncryptedString): ParsedIdentityEnvelope => {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) {
    throw new Error("Invalid encrypted payload");
  }
  const saltB64 = parsed.saltB64;
  const ivB64 = parsed.ivB64;
  const ciphertextB64 = parsed.ciphertextB64;
  if (typeof saltB64 !== "string" || typeof ivB64 !== "string" || typeof ciphertextB64 !== "string") {
    throw new Error("Invalid encrypted payload encoding");
  }

  const alg = typeof parsed.alg === "string" ? parsed.alg : "";
  const v = typeof parsed.v === "number" ? parsed.v : 0;

  if (alg === IDENTITY_ARGON2ID_ALG || v === 2) {
    return {
      v: v === 2 ? 2 : 1,
      kdf: {
        alg: IDENTITY_ARGON2ID_ALG,
        kdf: parseArgon2Params(parsed),
      },
      saltB64,
      ivB64,
      ciphertextB64,
    };
  }

  const iterations = parsed.iterations;
  if (typeof iterations !== "number") {
    throw new Error("Invalid encrypted payload iterations");
  }
  return {
    v: v === 1 ? 1 : 0,
    kdf: {
      alg: IDENTITY_PBKDF2_ALG,
      iterations,
    },
    saltB64,
    ivB64,
    ciphertextB64,
  };
};

export const isLegacyIdentityEnvelopePayload = (value: EncryptedString): boolean => {
  try {
    const envelope = parseIdentityEnvelope(value);
    return envelope.kdf.alg === IDENTITY_PBKDF2_ALG;
  } catch {
    return false;
  }
};
