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
}
