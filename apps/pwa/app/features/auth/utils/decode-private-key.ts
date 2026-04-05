import { nip19 } from "nostr-tools";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

/**
 * Decodes a private key input into a 64-character hex string.
 * Supports both hex and nsec formats.
 */
export const decodePrivateKey = (input: string): PrivateKeyHex | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Handle nsec
    if (trimmed.startsWith("nsec")) {
        try {
            const decoded = nip19.decode(trimmed);
            if (decoded.type === "nsec") {
                const bytes = decoded.data as Uint8Array;
                return Array.from(bytes)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('') as PrivateKeyHex;
            }
        } catch {
            // Invalid/partial nsec input is expected while users type; fail
            // quietly so auth validation can show inline guidance without
            // triggering global dev overlays.
            return null;
        }
    }

    // Handle hex
    const hexMatch = trimmed.match(/^[0-9a-fA-F]{64}$/);
    if (hexMatch) {
        return trimmed.toLowerCase() as PrivateKeyHex;
    }

    return null;
};
