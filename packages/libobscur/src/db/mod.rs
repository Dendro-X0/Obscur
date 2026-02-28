pub mod schema;
pub mod repositories;

use rusqlite::{Connection, Result};

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Initializes a new database connection (in-memory if path is None).
    pub fn new(path: Option<&str>) -> Result<Self> {
        let conn = match path {
            Some(p) => Connection::open(p)?,
            None => Connection::open_in_memory()?,
        };
        
        let db = Database { conn };
        db.apply_migrations()?;
        
        Ok(db)
    }

    /// Applies the initial SQL schema.
    fn apply_migrations(&self) -> Result<()> {
        self.conn.execute_batch(schema::INITIAL_SCHEMA)?;
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
}
