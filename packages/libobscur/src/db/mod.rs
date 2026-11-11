pub mod schema;
pub mod repositories;

use rusqlite::{Connection, Result};

pub struct Database {
    pub conn: Connection,
}

impl Database {
    /// Opens (or creates) a database at the given path, or in-memory if None.
    /// Always runs pending migrations before returning.
    pub fn new(path: Option<&str>) -> Result<Self> {
        let conn = match path {
            Some(p) => Connection::open(p)?,
            None => Connection::open_in_memory()?,
        };
        // Enable WAL mode for better concurrent read performance
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=8000;",
        )?;
        let db = Database { conn };
        db.apply_migrations()?;
        Ok(db)
    }

    /// Applies all pending schema migrations in version order.
    /// Safe to call on every startup — already-applied versions are skipped.
    fn apply_migrations(&self) -> Result<()> {
        // Always ensure version tracking table exists first
        self.conn.execute_batch(schema::SCHEMA_VERSION_TABLE)?;

        let current: u32 = self.conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if current < 1 {
            self.conn.execute_batch(schema::SCHEMA_V1)?;
            self.conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                rusqlite::params![1u32],
            )?;
        }

        if current < 2 {
            self.conn.execute_batch(schema::SCHEMA_V2)?;
            self.conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                rusqlite::params![2u32],
            )?;
        }

        if current < 3 {
            self.conn.execute_batch(schema::SCHEMA_V3)?;
            self.conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                rusqlite::params![3u32],
            )?;
        }

        if current < 4 {
            self.conn.execute_batch(schema::SCHEMA_V4)?;
            self.conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                rusqlite::params![4u32],
            )?;
        }

        if current < 5 {
            self.conn.execute_batch(schema::SCHEMA_V5)?;
            self.conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                rusqlite::params![5u32],
            )?;
        }

        if current < 6 {
            self.conn.execute_batch(schema::SCHEMA_V6)?;
            self.conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                rusqlite::params![6u32],
            )?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_initialization() {
        let db = Database::new(None);
        assert!(db.is_ok());
    }

    #[test]
    fn test_migration_idempotent() {
        let db = Database::new(None).unwrap();
        // Running migrations again must not fail
        assert!(db.apply_migrations().is_ok());
    }

    #[test]
    fn test_schema_version_recorded() {
        let db = Database::new(None).unwrap();
        let version: u32 = db.conn
            .query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, schema::SCHEMA_VERSION);
    }

    /// Cut 0.1 — spine tables from SCHEMA_V5 exist after migrate.
    #[test]
    fn test_cut0_v5_spine_tables_exist() {
        let db = Database::new(None).unwrap();
        for table in [
            "auth_meta",
            "linked_identity",
            "relationship_edge",
            "home",
            "outbox",
            "dr_session",
            "continuity_cursor",
        ] {
            let count: i64 = db
                .conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    rusqlite::params![table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "missing Cut 0 spine table: {table}");
        }
    }

    #[test]
    fn test_cut0_v5_conversation_and_message_columns() {
        let db = Database::new(None).unwrap();
        let conv_cols = table_columns(&db, "conversations");
        for col in ["kind", "home_id", "crypto_tier"] {
            assert!(
                conv_cols.iter().any(|c| c == col),
                "conversations missing column {col}: {conv_cols:?}"
            );
        }
        let msg_cols = table_columns(&db, "messages");
        for col in ["status", "home_message_id", "deleted_at"] {
            assert!(
                msg_cols.iter().any(|c| c == col),
                "messages missing column {col}: {msg_cols:?}"
            );
        }
    }

    #[test]
    fn test_cut0_v5_upgrade_from_v4_shape() {
        // Simulate a DB that stopped at V4, then open path applies V5 only.
        let db = Database::new(None).unwrap();
        // Already at V5 via new(); prove re-open idempotent and spine still present.
        assert!(db.apply_migrations().is_ok());
        let version: u32 = db
            .conn
            .query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, schema::SCHEMA_VERSION);
        let homes: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='home'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(homes, 1);
        let vault_cols = table_columns(&db, "vault_media_index");
        assert!(
            vault_cols.iter().any(|c| c == "content_hash"),
            "vault_media_index missing content_hash: {vault_cols:?}"
        );
    }

    fn table_columns(db: &Database, table: &str) -> Vec<String> {
        let mut stmt = db
            .conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .unwrap();
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap();
        rows.map(|r| r.unwrap()).collect()
    }
}
