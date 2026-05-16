/**
 * Native SQLite must have a **single** schema/version owner so Rust and TypeScript
 * never apply independent migrations to the same database file.
 *
 * Prefer **`rust`** as the product converges on one shared Rust backend; use
 * `typescript-drizzle` only if the team explicitly chooses TS-owned migrations
 * and Rust reads the same schema without duplicating migrators.
 */
export type NativeMigrationOwner = "rust" | "typescript-drizzle";

/** Default policy: Rust owns native SQL migrations (aligns with shared Tauri backend). */
export const NATIVE_MIGRATION_OWNER_DEFAULT: NativeMigrationOwner = "rust";
