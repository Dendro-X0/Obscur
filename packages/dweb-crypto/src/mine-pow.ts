import { toArrayBuffer } from "./to-array-buffer";

/**
 * Calculates the number of leading zero bits in a hex string.
 */
export const getLeadingZeros = (hex: string): number => {
    let zeros = 0;
    for (let i = 0; i < hex.length; i++) {
        const char: string | undefined = hex[i];
        if (char === undefined) break;

        const nibble: number = parseInt(char, 16);
        if (nibble === 0) {
            zeros += 4;
        } else {
            // Use Math.clz32 on the 4-bit nibble
            // For 4-bit nibbles (0-15), we shift left by 28 bits to make them 32-bit values
            // where the nibble occupies the most significant bits.
            zeros += Math.clz32(nibble << 28);
            break;
        }
    }
    return zeros;
};

const toHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
        .map((b: number) => b.toString(16).padStart(2, "0"))
        .join("");
};

export type NostrEventTemplate = {
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
};

/**
 * Mines a NIP-13 Proof of Work nonce for a Nostr event template.
 * 
 * @param template The unsigned event parts
 * @param difficulty Target number of leading zero bits
 */
export async function minePow(
    template: NostrEventTemplate,
    difficulty: number
): Promise<{ id: string; tags: string[][] }> {
    if (difficulty === 0) {
        return { id: "", tags: template.tags };
    }

    // Deep clone tags to avoid mutating the input
    const tags = template.tags.map(t => [...t]);
    let nonceTag = tags.find((t) => t[0] === "nonce");

    if (!nonceTag) {
        nonceTag = ["nonce", "0", difficulty.toString()];
        tags.push(nonceTag);
    } else {
        nonceTag[1] = "0";
        nonceTag[2] = difficulty.toString();
    }

    let nonce = 0;
    const encoder = new TextEncoder();

    while (true) {
        nonceTag[1] = nonce.toString();

        // NIP-13 Event ID calculation: sha256(json([0, pubkey, created_at, kind, tags, content]))
        const payload = JSON.stringify([
            0,
            template.pubkey,
            template.created_at,
            template.kind,
            tags,
            template.content
        ]);

        const bytes = encoder.encode(payload);
        const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
        const id = toHex(new Uint8Array(digest));

        if (getLeadingZeros(id) >= difficulty) {
            return { id, tags };
        }

        nonce++;

        // Periodically yield to prevent total UI blocking if running on main thread
        if (nonce % 500 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
}
