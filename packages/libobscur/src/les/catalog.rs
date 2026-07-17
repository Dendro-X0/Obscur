use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use super::paths::les_catalog_path;
use super::types::{LesKind, LesObjectMeta, LesSource};

pub fn open_catalog(data_root: &Path, profile_id: &str) -> Result<Connection, String> {
    let path = les_catalog_path(data_root, profile_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS les_objects (
          les_object_id TEXT PRIMARY KEY NOT NULL,
          profile_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          display_name TEXT NOT NULL,
          content_type TEXT NOT NULL,
          byte_length INTEGER NOT NULL,
          created_at_unix_ms INTEGER NOT NULL,
          source TEXT NOT NULL,
          source_attachment_url TEXT,
          relative_path TEXT NOT NULL UNIQUE
        );
        CREATE INDEX IF NOT EXISTS idx_les_objects_profile_created
          ON les_objects(profile_id, created_at_unix_ms DESC);
        "#,
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn insert_object(conn: &Connection, meta: &LesObjectMeta) -> Result<i64, String> {
    conn.execute(
        r#"
        INSERT INTO les_objects (
          les_object_id, profile_id, kind, display_name, content_type, byte_length,
          created_at_unix_ms, source, source_attachment_url, relative_path
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
        params![
            meta.les_object_id,
            meta.profile_id,
            meta.kind.as_str(),
            meta.display_name,
            meta.content_type,
            meta.byte_length as i64,
            meta.created_at_unix_ms,
            meta.source.as_str(),
            meta.source_attachment_url,
            meta.relative_path,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

fn map_row(row: &rusqlite::Row<'_>) -> Result<LesObjectMeta, rusqlite::Error> {
    let kind_raw: String = row.get(2)?;
    let source_raw: String = row.get(7)?;
    Ok(LesObjectMeta {
        les_object_id: row.get(0)?,
        profile_id: row.get(1)?,
        kind: LesKind::parse(&kind_raw).unwrap_or(LesKind::File),
        display_name: row.get(3)?,
        content_type: row.get(4)?,
        byte_length: row.get::<_, i64>(5)? as u64,
        created_at_unix_ms: row.get(6)?,
        source: LesSource::parse(&source_raw).unwrap_or(LesSource::SecureUpload),
        source_attachment_url: row.get(8)?,
        relative_path: row.get(9)?,
    })
}

pub fn list_objects(data_root: &Path, profile_id: &str) -> Result<Vec<LesObjectMeta>, String> {
    let conn = open_catalog(data_root, profile_id)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT les_object_id, profile_id, kind, display_name, content_type, byte_length,
                   created_at_unix_ms, source, source_attachment_url, relative_path
            FROM les_objects
            WHERE profile_id = ?1
            ORDER BY created_at_unix_ms DESC
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![profile_id.trim()], map_row)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn get_object(
    data_root: &Path,
    profile_id: &str,
    les_object_id: &str,
) -> Result<Option<LesObjectMeta>, String> {
    let conn = open_catalog(data_root, profile_id)?;
    conn.query_row(
        r#"
        SELECT les_object_id, profile_id, kind, display_name, content_type, byte_length,
               created_at_unix_ms, source, source_attachment_url, relative_path
        FROM les_objects
        WHERE profile_id = ?1 AND les_object_id = ?2
        "#,
        params![profile_id.trim(), les_object_id.trim()],
        map_row,
    )
    .optional()
    .map_err(|e| e.to_string())
}

/// Removes the catalog row for `(profile_id, les_object_id)`. Returns `true` if a row was deleted.
pub fn delete_object_row(
    data_root: &Path,
    profile_id: &str,
    les_object_id: &str,
) -> Result<bool, String> {
    let conn = open_catalog(data_root, profile_id)?;
    let changed = conn
        .execute(
            r#"
            DELETE FROM les_objects
            WHERE profile_id = ?1 AND les_object_id = ?2
            "#,
            params![profile_id.trim(), les_object_id.trim()],
        )
        .map_err(|e| e.to_string())?;
    Ok(changed > 0)
}

pub fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
