use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LesKind {
    Image,
    Video,
    Audio,
    File,
}

impl LesKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Image => "image",
            Self::Video => "video",
            Self::Audio => "audio",
            Self::File => "file",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "image" => Some(Self::Image),
            "video" => Some(Self::Video),
            "audio" | "voice_note" => Some(Self::Audio),
            "file" => Some(Self::File),
            _ => None,
        }
    }

    pub fn dir_name(self) -> &'static str {
        match self {
            Self::Image => "images",
            Self::Video => "videos",
            Self::Audio => "audio",
            Self::File => "files",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LesSource {
    SecureUpload,
    ChatSave,
}

impl LesSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SecureUpload => "secure_upload",
            Self::ChatSave => "chat_save",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "secure_upload" => Some(Self::SecureUpload),
            "chat_save" => Some(Self::ChatSave),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LesObjectMeta {
    pub les_object_id: String,
    pub profile_id: String,
    pub kind: LesKind,
    pub display_name: String,
    pub content_type: String,
    pub byte_length: u64,
    pub created_at_unix_ms: i64,
    pub source: LesSource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_attachment_url: Option<String>,
    pub relative_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LesCommitReceipt {
    pub les_object_id: String,
    pub profile_id: String,
    pub relative_path: String,
    pub catalog_revision: i64,
}
