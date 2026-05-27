import { hasNativeRuntime } from "./runtime-capabilities";
import { getDmHydrateRecoveryFlags } from "./persistence-policy";

/**
 * True when durable state must use SQLite (desktop + mobile Tauri).
 * @see docs/program/obscur-native-sqlite-policy.md
 */
export const requiresSqlitePersistence = (): boolean => hasNativeRuntime();

/** @deprecated Use {@link getDmHydrateRecoveryFlags} from persistence-policy. */
export const getNativeDmHydrateRecoveryFlags = getDmHydrateRecoveryFlags;
