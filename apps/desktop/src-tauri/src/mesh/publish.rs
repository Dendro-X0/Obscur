//! Mesh publish bridge — R-RELAY-RUST-1d (nostr_ws via RelayPool ACK).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshPublishEvidence {
    pub evidence_id: String,
    pub envelope_id: String,
    pub kind: String,
    pub at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conduit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub external_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshPublishOutcome {
    pub envelope_id: String,
    pub accepted: bool,
    pub evidence: Vec<MeshPublishEvidence>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub relay_urls_attempted: Vec<String>,
    pub success_count: u32,
}

/// Prefer mesh active URLs; optional caller URLs must be a subset (no escape to public hosts).
pub fn resolve_mesh_publish_urls(
    mesh_active_urls: &[String],
    requested_urls: Option<&[String]>,
) -> Result<Vec<String>, String> {
    if mesh_active_urls.is_empty() {
        return Err("no_mesh_active_endpoints".into());
    }
    let Some(requested) = requested_urls else {
        return Ok(mesh_active_urls.to_vec());
    };
    if requested.is_empty() {
        return Ok(mesh_active_urls.to_vec());
    }
    let allowed: std::collections::HashSet<&str> = mesh_active_urls
        .iter()
        .map(|u| u.as_str())
        .collect();
    let mut out = Vec::new();
    for url in requested {
        let trimmed = url.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !allowed.contains(trimmed) {
            return Err(format!("relay_url_not_in_mesh_active_set:{trimmed}"));
        }
        if !out.iter().any(|u: &String| u == trimmed) {
            out.push(trimmed.to_string());
        }
    }
    if out.is_empty() {
        return Err("no_mesh_publish_targets".into());
    }
    Ok(out)
}

pub fn build_publish_outcome(params: BuildPublishOutcomeParams<'_>) -> MeshPublishOutcome {
    let mut evidence = Vec::new();
    let mut success_count = 0u32;
    for (url, ok, err) in params.attempts {
        if *ok {
            success_count += 1;
            evidence.push(MeshPublishEvidence {
                evidence_id: format!("mesh-{}-{}-published", params.envelope_id, url),
                envelope_id: params.envelope_id.to_string(),
                kind: "published_to_conduit".into(),
                at_unix_ms: params.at_unix_ms,
                conduit_id: None,
                external_ref: Some(url.clone()),
                failure_reason: None,
            });
            evidence.push(MeshPublishEvidence {
                evidence_id: format!("mesh-{}-{}-accepted", params.envelope_id, url),
                envelope_id: params.envelope_id.to_string(),
                kind: "accepted_by_operator".into(),
                at_unix_ms: params.at_unix_ms,
                conduit_id: None,
                external_ref: Some(url.clone()),
                failure_reason: None,
            });
        } else {
            evidence.push(MeshPublishEvidence {
                evidence_id: format!("mesh-{}-{}-failed", params.envelope_id, url),
                envelope_id: params.envelope_id.to_string(),
                kind: "publish_failed".into(),
                at_unix_ms: params.at_unix_ms,
                conduit_id: None,
                external_ref: Some(url.clone()),
                failure_reason: err.clone().or_else(|| Some("publish_failed".into())),
            });
        }
    }

    let accepted = success_count > 0;
    if accepted {
        evidence.push(MeshPublishEvidence {
            evidence_id: format!("mesh-{}-satisfied", params.envelope_id),
            envelope_id: params.envelope_id.to_string(),
            kind: "evidence_class_satisfied".into(),
            at_unix_ms: params.at_unix_ms,
            conduit_id: None,
            external_ref: None,
            failure_reason: None,
        });
    }

    MeshPublishOutcome {
        envelope_id: params.envelope_id.to_string(),
        accepted,
        evidence,
        error_message: if accepted {
            None
        } else {
            Some(
                params
                    .attempts
                    .iter()
                    .find_map(|(_, ok, err)| if !*ok { err.clone() } else { None })
                    .unwrap_or_else(|| "all_conduits_exhausted".into()),
            )
        },
        relay_urls_attempted: params.attempts.iter().map(|(u, _, _)| u.clone()).collect(),
        success_count,
    }
}

pub struct BuildPublishOutcomeParams<'a> {
    pub envelope_id: &'a str,
    pub at_unix_ms: u64,
    pub attempts: &'a [(String, bool, Option<String>)],
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_defaults_to_mesh_active() {
        let urls = vec!["ws://127.0.0.1:7000".into(), "ws://127.0.0.1:7001".into()];
        let resolved = resolve_mesh_publish_urls(&urls, None).unwrap();
        assert_eq!(resolved, urls);
    }

    #[test]
    fn resolve_rejects_url_outside_mesh() {
        let urls = vec!["ws://127.0.0.1:7000".into()];
        let requested = vec!["wss://relay.damus.io".to_string()];
        let err = resolve_mesh_publish_urls(&urls, Some(&requested)).unwrap_err();
        assert!(err.contains("not_in_mesh_active_set"));
    }

    #[test]
    fn outcome_accepted_when_one_ok() {
        let attempts = vec![
            ("ws://a".into(), false, Some("timeout".into())),
            ("ws://b".into(), true, None),
        ];
        let out = build_publish_outcome(BuildPublishOutcomeParams {
            envelope_id: "env-1",
            at_unix_ms: 1,
            attempts: &attempts,
        });
        assert!(out.accepted);
        assert_eq!(out.success_count, 1);
        assert!(out
            .evidence
            .iter()
            .any(|e| e.kind == "evidence_class_satisfied"));
    }
}
