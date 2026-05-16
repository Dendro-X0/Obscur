
/**
 * IndexedDB entry: main messenger DB (`messagingDB`).
 * Implementation lives in `./indexed-db-engine` so other modules (e.g. tombstones)
 * can use the engine without going through this file (important for partial Vitest mocks).
 */

export type { DBConfig } from "./indexed-db-engine";
export { IndexedDBService } from "./indexed-db-engine";

import { IndexedDBService } from "./indexed-db-engine";

const DEFAULT_DB_NAME = "dweb_messenger_db";
const DEFAULT_VERSION = 2;

export const messagingDB = new IndexedDBService({
    name: DEFAULT_DB_NAME,
    version: DEFAULT_VERSION,
    stores: {
        chatState: "publicKeyHex",
        messages: "id", // Combined ID for messages
        conversations: "id",
    }
});
