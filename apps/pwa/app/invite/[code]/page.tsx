"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { nip19 } from "nostr-tools";

export default function InvitePage() {
    const router = useRouter();
    const params = useParams();
    const code = params.code as string;

    useEffect(() => {
        if (!code) return;

        try {
            // Decode the nprofile or npub
            const decoded = nip19.decode(code);

            if (decoded.type === 'nprofile') {
                const { pubkey, relays } = decoded.data;

                // We'll pass the relays as a query param so the main page can add them
                const relayParams = relays && relays.length > 0
                    ? `&relays=${encodeURIComponent(relays.join(','))}`
                    : '';

                router.replace(`/?chat=${pubkey}${relayParams}`);
            } else if (decoded.type === 'npub') {
                router.replace(`/?chat=${decoded.data}`);
            } else {
                // Fallback for raw hex or other types
                router.replace(`/?chat=${code}`);
            }
        } catch (err) {
            console.error("Invalid invite code:", err);
            // If it's not a valid nip19, maybe it's a raw hex
            router.replace(`/?chat=${code}`);
        }
    }, [code, router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="text-center">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto"></div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Opening Invite...</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Connecting you to the conversation</p>
            </div>
        </div>
    );
}
