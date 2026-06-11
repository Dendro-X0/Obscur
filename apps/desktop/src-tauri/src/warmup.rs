use libobscur::db::Database;
use libobscur::db::repositories::{ConversationRecord, GroupRecord};
use std::time::Instant;

pub const MAX_DM_CONVERSATION_HEADS: usize = 12;
pub const MAX_GROUP_MESSAGE_HEADS: usize = 6;
pub const MESSAGE_HEAD_LIMIT: u32 = 24;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WarmupTask {
    pub id: &'static str,
    pub label: &'static str,
}

pub fn warmup_task_plan() -> Vec<WarmupTask> {
    vec![
        WarmupTask {
            id: "conversations",
            label: "conversations",
        },
        WarmupTask {
            id: "groups",
            label: "groups",
        },
        WarmupTask {
            id: "tombstones",
            label: "tombstones",
        },
        WarmupTask {
            id: "relay_checkpoints",
            label: "relay_checkpoints",
        },
        WarmupTask {
            id: "dm_message_heads",
            label: "dm_message_heads",
        },
        WarmupTask {
            id: "group_message_heads",
            label: "group_message_heads",
        },
        WarmupTask {
            id: "static_shell",
            label: "static_shell",
        },
    ]
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WarmupRunMetrics {
    pub conversation_count: u32,
    pub group_count: u32,
    pub tombstone_count: u32,
    pub relay_checkpoint_count: u32,
    pub dm_message_head_count: u32,
    pub group_message_head_count: u32,
    pub elapsed_ms: u64,
}

pub fn run_profile_warmup(
    db: &Database,
    profile_id: &str,
    mut on_progress: impl FnMut(&str, u32, u32),
) -> Result<WarmupRunMetrics, String> {
    let started = Instant::now();
    let tasks = warmup_task_plan();
    let total_tasks = tasks.len() as u32;
    let mut completed_tasks: Vec<String> = Vec::with_capacity(tasks.len());
    let mut metrics = WarmupRunMetrics {
        conversation_count: 0,
        group_count: 0,
        tombstone_count: 0,
        relay_checkpoint_count: 0,
        dm_message_head_count: 0,
        group_message_head_count: 0,
        elapsed_ms: 0,
    };
    let mut conversations: Vec<ConversationRecord> = Vec::new();
    let mut groups: Vec<GroupRecord> = Vec::new();

    let mut report = |task_id: &str| {
        completed_tasks.push(task_id.to_string());
        on_progress(task_id, completed_tasks.len() as u32, total_tasks);
    };

    for task in &tasks {
        match task.id {
            "conversations" => {
                conversations = db
                    .get_conversations(profile_id)
                    .map_err(|error| format!("warmup conversations failed: {error}"))?;
                metrics.conversation_count = conversations.len() as u32;
            }
            "groups" => {
                groups = db
                    .get_groups(profile_id)
                    .map_err(|error| format!("warmup groups failed: {error}"))?;
                metrics.group_count = groups.len() as u32;
            }
            "tombstones" => {
                let tombstones = db
                    .get_tombstones(profile_id)
                    .map_err(|error| format!("warmup tombstones failed: {error}"))?;
                metrics.tombstone_count = tombstones.len() as u32;
            }
            "relay_checkpoints" => {
                let checkpoints = db
                    .get_relay_checkpoints(profile_id)
                    .map_err(|error| format!("warmup relay checkpoints failed: {error}"))?;
                metrics.relay_checkpoint_count = checkpoints.len() as u32;
            }
            "dm_message_heads" => {
                for conversation in conversations.iter().take(MAX_DM_CONVERSATION_HEADS) {
                    let messages = db
                        .get_messages_by_conversation(
                            profile_id,
                            &conversation.id,
                            MESSAGE_HEAD_LIMIT,
                            None,
                        )
                        .map_err(|error| {
                            format!(
                                "warmup dm message head failed for {}: {error}",
                                conversation.id
                            )
                        })?;
                    metrics.dm_message_head_count += messages.len() as u32;
                }
            }
            "group_message_heads" => {
                for group in groups.iter().take(MAX_GROUP_MESSAGE_HEADS) {
                    let messages = db
                        .get_group_messages(profile_id, &group.id, MESSAGE_HEAD_LIMIT, None)
                        .map_err(|error| {
                            format!("warmup group message head failed for {}: {error}", group.id)
                        })?;
                    metrics.group_message_head_count += messages.len() as u32;
                }
            }
            "static_shell" => {
                // Best-effort OS page-cache warm for packaged shell assets (commands layer).
            }
            _ => {}
        }
        report(task.id);
    }

    metrics.elapsed_ms = started.elapsed().as_millis() as u64;
    Ok(metrics)
}

pub fn warmup_static_shell_readahead(path: &std::path::Path) -> bool {
    std::fs::read(path).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn warmup_task_plan_is_stable() {
        let plan = warmup_task_plan();
        assert_eq!(plan.len(), 7);
        assert_eq!(plan.first().map(|task| task.id), Some("conversations"));
        assert_eq!(plan.last().map(|task| task.id), Some("static_shell"));
    }

    #[test]
    fn run_profile_warmup_completes_on_empty_database() {
        let db = Database::new(Some(":memory:")).expect("in-memory database");
        let mut progress_reports = Vec::new();
        let metrics = run_profile_warmup(&db, "profile-a", |task_id, completed, total| {
            progress_reports.push((task_id.to_string(), completed, total));
        })
        .expect("warmup should succeed");

        assert_eq!(progress_reports.len(), warmup_task_plan().len());
        assert_eq!(metrics.conversation_count, 0);
        assert_eq!(metrics.group_count, 0);
    }

}
