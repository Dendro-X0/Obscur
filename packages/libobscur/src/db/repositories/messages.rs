use rusqlite::{params, Result};
use crate::db::Database;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageRecord {
    pub id: String,
    pub conversation_id: String,
    pub sender_pubkey: String,
    pub content_encrypted: String,
    pub kind: u32,
    pub status: String,
    pub created_at: u64,
}

impl Database {
    pub fn insert_message(&self, msg: &MessageRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO messages (id, conversation_id, sender_pubkey, content_encrypted, kind, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                msg.id,
                msg.conversation_id,
                msg.sender_pubkey,
                msg.content_encrypted,
                msg.kind,
                msg.status,
                msg.created_at
            ],
        )?;
        Ok(())
    }

    pub fn get_messages_by_conversation(&self, conversation_id: &str, limit: u32) -> Result<Vec<MessageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, sender_pubkey, content_encrypted, kind, status, created_at
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2"
        )?;
        
        let message_iter = stmt.query_map(params![conversation_id, limit], |row| {
            Ok(MessageRecord {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                sender_pubkey: row.get(2)?,
                content_encrypted: row.get(3)?,
                kind: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message?);
        }
        
        Ok(messages)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    #[test]
    fn test_message_persistence() {
        let db = Database::new(None).unwrap();
        
        let msg = MessageRecord {
            id: "msg1".to_string(),
            conversation_id: "conv1".to_string(),
            sender_pubkey: "pub1".to_string(),
            content_encrypted: "topsecret".to_string(),
            kind: 1,
            status: "sent".to_string(),
            created_at: 1700000000,
        };
        
        db.insert_message(&msg).unwrap();
        
        let messages = db.get_messages_by_conversation("conv1", 10).unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content_encrypted, "topsecret");
    }
}
