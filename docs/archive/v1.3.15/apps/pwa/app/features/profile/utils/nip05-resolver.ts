import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/**
 * NIP-05 Resolution Result
 */
export type Nip05Result =
    | { ok: true; publicKeyHex: PublicKeyHex; identifier: string }
    | { ok: false; reason: 'fetch_failed' | 'invalid_json' | 'not_found' | 'invalid_identifier' };

/**
 * Resolves a NIP-05 identifier (e.g., alice@example.com) to a Nostr public key.
 * 
 * NIP-05: DNS-based verification of Nostr identities
 * See: https://github.com/nostr-protocol/nips/blob/master/05.md
 */
export const resolveNip05 = async (identifier: string): Promise<Nip05Result> => {
    const parts = identifier.split('@');

    if (parts.length !== 2) {
        return { ok: false, reason: 'invalid_identifier' };
    }

    const [name, domain] = parts;
    if (!name || !domain) {
        return { ok: false, reason: 'invalid_identifier' };
    }

    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return { ok: false, reason: 'fetch_failed' };
        }

        const data = await response.json();

        if (!data.names || typeof data.names !== 'object') {
            return { ok: false, reason: 'invalid_json' };
        }

        const pubkey = data.names[name];

        if (!pubkey || typeof pubkey !== 'string') {
            return { ok: false, reason: 'not_found' };
        }

        // Return as PublicKeyHex (assumes it's a valid 64-char hex string from the server)
        return {
            ok: true,
            publicKeyHex: pubkey as PublicKeyHex,
            identifier
        };

    } catch (error) {
        console.error('NIP-05 Resolution Error:', error);
        return { ok: false, reason: 'fetch_failed' };
    }
};
