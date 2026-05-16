import type { TombstoneRecord } from "@dweb/db";

const CAPACITOR_SQLITE_DB_NAME = "obscur.sqlite3";
const CAPACITOR_SQLITE_VERSION = 1;
const CAPACITOR_SQLITE_MODE = "no-encryption";

let moduleLoadAttempted = false;
let sqliteModule: any | null = null;
let dbOpenPromise: Promise<any | null> | null = null;
let dbInstance: any | null = null;

const getSqliteDbConnection = async (): Promise<any | null> => {
  if (dbInstance) {
    return dbInstance;
  }
  if (dbOpenPromise) {
    return dbOpenPromise;
  }
  dbOpenPromise = (async () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!moduleLoadAttempted) {
      moduleLoadAttempted = true;
      // Important: use string concatenation so Vite cannot statically resolve the module.
      // Mobile builds can provide the dependency at runtime; web/test builds should not fail.
      // Vite still tries to resolve constant import specifiers (even with concatenation).
      // Using Function(import) makes the module specifier non-statically-analyzable.
      const pkg = "@capacitor-community/sqlite";
      // eslint-disable-next-line no-new-func
      sqliteModule = await (new Function("pkg", "return import(pkg)"))(pkg).catch(() => null);
    }

    const SQLiteConnection = sqliteModule?.SQLiteConnection;
    const CapacitorSQLite = sqliteModule?.CapacitorSQLite;
    if (!SQLiteConnection || !CapacitorSQLite) {
      return null;
    }

    const sqlite = new SQLiteConnection(CapacitorSQLite);

    let db: any;
    // Capacitor-community/sqlite has multiple createConnection signatures across versions.
    try {
      db = await sqlite.createConnection(
        CAPACITOR_SQLITE_DB_NAME,
        false,
        CAPACITOR_SQLITE_MODE,
        CAPACITOR_SQLITE_VERSION,
        false,
      );
    } catch {
      db = await sqlite.createConnection(
        CAPACITOR_SQLITE_DB_NAME,
        false,
        CAPACITOR_SQLITE_MODE,
        CAPACITOR_SQLITE_VERSION,
      );
    }

    if (!db) {
      return null;
    }

    await db.open();
    dbInstance = db;
    return dbInstance;
  })();

  return dbOpenPromise;
};

const mapQueryValuesToTombstones = (values: unknown): TombstoneRecord[] => {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const first = values[0];
  // Typical sqlite plugin returns rows as arrays: [event_id, profile_id, deleted_at, deleted_by]
  if (Array.isArray(first)) {
    return (values as Array<unknown[]>).map((row) => ({
      event_id: String(row[0] ?? ""),
      profile_id: String(row[1] ?? ""),
      deleted_at: Number(row[2] ?? 0),
      deleted_by: String(row[3] ?? ""),
    })).filter((r) => Boolean(r.event_id) && Boolean(r.profile_id));
  }

  // Some plugin variants return rows as objects keyed by column names.
  if (typeof first === "object" && first !== null) {
    return (values as Array<Record<string, unknown>>).map((row) => ({
      event_id: String(row.event_id ?? row.eventId ?? row.eventID ?? ""),
      profile_id: String(row.profile_id ?? row.profileId ?? ""),
      deleted_at: Number(row.deleted_at ?? row.deletedAtUnixMs ?? row.deletedAt ?? 0),
      deleted_by: String(row.deleted_by ?? row.deletedBy ?? ""),
    })).filter((r) => Boolean(r.event_id) && Boolean(r.profile_id));
  }

  return [];
};

const runQuery = async (sql: string, params: ReadonlyArray<unknown>): Promise<TombstoneRecord[]> => {
  const db = await getSqliteDbConnection();
  if (!db) {
    throw new Error("capacitior-sqlite-unavailable");
  }

  const queryFn = typeof db.query === "function" ? db.query.bind(db) : null;
  if (!queryFn) {
    throw new Error("capacitior-sqlite-query-unavailable");
  }

  const res = await queryFn(sql, params);
  const values = Array.isArray(res?.values)
    ? res.values
    : Array.isArray(res?.values?.values)
      ? res.values.values
      : [];
  return mapQueryValuesToTombstones(values);
};

export const capacitorDbGetTombstones = async (
  profileId: string,
): Promise<ReadonlyArray<TombstoneRecord>> => {
  return runQuery(
    `SELECT event_id, profile_id, deleted_at, deleted_by
     FROM tombstones
     WHERE profile_id = ?
     ORDER BY deleted_at DESC`,
    [profileId],
  );
};

const runStatement = async (sql: string, params: ReadonlyArray<unknown>): Promise<void> => {
  const db = await getSqliteDbConnection();
  if (!db) {
    throw new Error("capacitior-sqlite-unavailable");
  }

  const runner = typeof db.run === "function" ? db.run.bind(db)
    : typeof db.execute === "function" ? db.execute.bind(db)
      : null;

  if (!runner) {
    throw new Error("capacitior-sqlite-run-unavailable");
  }

  await runner(sql, params);
};

export const capacitorDbInsertTombstone = async (
  tombstone: TombstoneRecord,
): Promise<void> => {
  // Mirrors libobscur insert_tombstone merge semantics.
  await runStatement(
    `INSERT INTO tombstones (event_id, profile_id, deleted_at, deleted_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(event_id, profile_id) DO UPDATE SET
       deleted_at = CASE
         WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_at
         ELSE tombstones.deleted_at END,
       deleted_by = CASE
         WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_by
         ELSE tombstones.deleted_by END`,
    [tombstone.event_id, tombstone.profile_id, tombstone.deleted_at, tombstone.deleted_by],
  );
};

export const capacitorDbDeleteAllTombstonesForProfile = async (
  profileId: string,
): Promise<void> => {
  await runStatement(
    `DELETE FROM tombstones WHERE profile_id = ?`,
    [profileId],
  );
};

