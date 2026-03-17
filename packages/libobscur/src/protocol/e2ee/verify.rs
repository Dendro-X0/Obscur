use crate::protocol::e2ee::ratchet::accept_incoming_counter;
use crate::protocol::types::{EnvelopeVerifyContext, MessageVerifyResult, RatchetChainState, SecurityReasonCode, unix_ms_now};

pub fn verify_envelope(
    state: &mut RatchetChainState,
    context: &EnvelopeVerifyContext,
) -> MessageVerifyResult {
    if context.session_id.trim().is_empty() || context.message_id.trim().is_empty() {
        return MessageVerifyResult {
            ok: false,
            session_id: Some(context.session_id.clone()),
            message_id: Some(context.message_id.clone()),
            verified_at_unix_ms: None,
            reason: Some(SecurityReasonCode::InvalidInput),
            message: Some("Session id and message id are required.".to_string()),
        };
    }
    if context.envelope_version != "v090_x3dr" {
        return MessageVerifyResult {
            ok: false,
            session_id: Some(context.session_id.clone()),
            message_id: Some(context.message_id.clone()),
            verified_at_unix_ms: None,
            reason: Some(SecurityReasonCode::UnsupportedToken),
            message: Some("Unsupported envelope version for protocol verification.".to_string()),
        };
    }
    if context.ciphertext.trim().is_empty() {
        return MessageVerifyResult {
            ok: false,
            session_id: Some(context.session_id.clone()),
            message_id: Some(context.message_id.clone()),
            verified_at_unix_ms: None,
            reason: Some(SecurityReasonCode::InvalidInput),
            message: Some("Ciphertext is required.".to_string()),
        };
    }

    match accept_incoming_counter(state, context.counter) {
        Ok(_) => MessageVerifyResult {
            ok: true,
            session_id: Some(context.session_id.clone()),
            message_id: Some(context.message_id.clone()),
            verified_at_unix_ms: Some(unix_ms_now()),
            reason: None,
            message: None,
        },
        Err(reason) => MessageVerifyResult {
            ok: false,
            session_id: Some(context.session_id.clone()),
            message_id: Some(context.message_id.clone()),
            verified_at_unix_ms: None,
            reason: Some(reason),
            message: Some("Envelope verification failed due to ratchet state.".to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_state() -> RatchetChainState {
        RatchetChainState {
            root_key_hex: "11".repeat(32),
            sending_chain_key_hex: "22".repeat(32),
            receiving_chain_key_hex: "33".repeat(32),
            send_counter: 0,
            recv_counter: 0,
            previous_message_counter: None,
        }
    }

    #[test]
    fn rejects_unsupported_version() {
        let mut state = base_state();
        let result = verify_envelope(
            &mut state,
            &EnvelopeVerifyContext {
                session_id: "s".into(),
                message_id: "m".into(),
                counter: 1,
                envelope_version: "legacy".into(),
                ciphertext: "abc".into(),
            },
        );
        assert!(!result.ok);
        assert_eq!(result.reason, Some(SecurityReasonCode::UnsupportedToken));
    }
}
