import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { INVITE_CODE_PREFIX } from "./invite-code-format";

const LEGACY_INVITE_CODE_PREFIX = "OBSCUR";
const INVITE_CODE_PREFIXES = Array.from(new Set([INVITE_CODE_PREFIX, LEGACY_INVITE_CODE_PREFIX]));

const isCanonicalInviteCode = (value: string): boolean => {
    return INVITE_CODE_PREFIXES.some((prefix) => {
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`^${escaped}-[A-Z0-9]{5,10}$`).test(value);
    });
};

export type InviteData = Readonly<{
    code: string;
    publicKeyHex?: PublicKeyHex;
    displayName?: string;
    avatar?: string;
}>;

/**
 * Validates the format of an invite code
 */
export const isValidInviteCode = (code: string | undefined | null): boolean => {
    if (!code) return false;
    return isCanonicalInviteCode(code.trim().toUpperCase());
};

/**
 * Parses an invite code string to ensure it follows the format
 */
export const parseInviteCode = (input: string | undefined | null): InviteData | null => {
    if (!input) return null;
    const trimmed = input.trim().toUpperCase();
    if (!isCanonicalInviteCode(trimmed)) return null;

    return {
      code: trimmed,
    };
};
