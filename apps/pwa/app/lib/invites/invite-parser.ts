import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const INVITE_CODE_PATTERN = /^OBSCUR-([A-Z0-9]{6})$/;

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
    return INVITE_CODE_PATTERN.test(code.trim().toUpperCase());
};

/**
 * Parses an invite code string to ensure it follows the format
 */
export const parseInviteCode = (input: string | undefined | null): InviteData | null => {
    if (!input) return null;
    const trimmed = input.trim().toUpperCase();
    const match = trimmed.match(INVITE_CODE_PATTERN);
    if (!match) return null;

    return {
        code: trimmed,
    };
};
