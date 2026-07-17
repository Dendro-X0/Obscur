//! Local Encrypted Store (LES) — greenfield vault replacement (Rust owner).

mod catalog;
mod intake;
mod paths;

pub use catalog::{get_object, list_objects, open_catalog};
pub use intake::{commit_object, delete_object, CommitInput, LesCommitError};
pub use paths::{ensure_les_tree, les_blob_relative_path, les_catalog_path, les_root, sanitize_profile_id};
pub use types::{LesCommitReceipt, LesKind, LesObjectMeta, LesSource};

mod types;
