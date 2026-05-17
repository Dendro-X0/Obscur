import { WebSocketServer, WebSocket } from "ws";
import { crypto } from "node:crypto";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 7001;
const UPSTREAM_URL = process.env.UPSTREAM_URL || "ws://localhost:7000";
const MIN_POW_DIFFICULTY = 12;

console.log(`[Relay Gateway] Starting on port ${PORT}...`);
console.log(`[Relay Gateway] Upstream: ${UPSTREAM_URL}`);
console.log(`[Relay Gateway] Min PoW Difficulty for K0: ${MIN_POW_DIFFICULTY}`);

const wss = new WebSocketServer({ port: PORT });

/**
 * Calculates PoW difficulty from an event ID (hex string)
 */
function getDifficulty(id: string): number {
    let difficulty = 0;
    for (let i = 0; i < id.length; i++) {
        const char = id[i];
        if (!char) break;
        const nibble = parseInt(char, 16);
        if (nibble === 0) {
            difficulty += 4;
        } else {
            // Count leading zeros in the nibble
            difficulty += Math.clz32(nibble) - 28;
            break;
        }
    }
    return difficulty;
}

wss.on("connection", (clientWs) => {
    console.log("[Relay Gateway] Client connected");

    const upstreamWs = new WebSocket(UPSTREAM_URL);

    let isUpstreamOpen = false;
    const pendingMessages: string[] = [];

    upstreamWs.on("open", () => {
        isUpstreamOpen = true;
        console.log("[Relay Gateway] Connected to upstream relay");
        while (pendingMessages.length > 0) {
            const msg = pendingMessages.shift();
            if (msg) upstreamWs.send(msg);
        }
    });

    upstreamWs.on("message", (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString());
        }
    });

    upstreamWs.on("close", () => {
        console.log("[Relay Gateway] Upstream closed connection");
        clientWs.close();
    });

    upstreamWs.on("error", (err) => {
        console.error("[Relay Gateway] Upstream error:", err);
        clientWs.close();
    });

    clientWs.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (Array.isArray(message) && message[0] === "EVENT") {
                const event = message[1];

                // Only enforce PoW on kind 0 (Metadata/Registration)
                if (event.kind === 0) {
                    const difficulty = getDifficulty(event.id);
                    const nonceTag = event.tags.find((t: string[]) => t[0] === "nonce");

                    if (!nonceTag || difficulty < MIN_POW_DIFFICULTY) {
                        console.warn(`[Relay Gateway] REJECTED kind 0 from ${event.pubkey.slice(0, 8)}: Insufficient PoW (${difficulty}/${MIN_POW_DIFFICULTY})`);
                        clientWs.send(JSON.stringify([
                            "OK",
                            event.id,
                            false,
                            `pow: insufficient proof of work (difficulty ${difficulty}, required ${MIN_POW_DIFFICULTY})`
                        ]));
                        return;
                    }

                    console.info(`[Relay Gateway] ACCEPTED kind 0 from ${event.pubkey.slice(0, 8)}: PoW difficulty ${difficulty}`);
                }
            }

            // Forward to upstream
            if (isUpstreamOpen) {
                upstreamWs.send(data.toString());
            } else {
                pendingMessages.push(data.toString());
            }
        } catch (e) {
            console.error("[Relay Gateway] Error parsing client message:", e);
        }
    });

    clientWs.on("close", () => {
        console.log("[Relay Gateway] Client disconnected");
        upstreamWs.close();
    });

    clientWs.on("error", (err) => {
        console.error("[Relay Gateway] Client error:", err);
        upstreamWs.close();
    });
});
