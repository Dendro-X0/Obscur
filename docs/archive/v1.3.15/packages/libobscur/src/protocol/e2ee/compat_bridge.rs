use crate::protocol::types::SecurityReasonCode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EnvelopeVersion {
    Legacy,
    V090X3DR,
}

#[derive(Debug, Clone)]
pub struct CompatDecision {
    pub path: &'static str,
    pub reason: Option<SecurityReasonCode>,
}

pub fn classify_envelope(version: &str) -> EnvelopeVersion {
    if version.eq_ignore_ascii_case("v090_x3dr") {
        EnvelopeVersion::V090X3DR
    } else {
        EnvelopeVersion::Legacy
    }
}

pub fn route(version: EnvelopeVersion, x3dh_enabled: bool) -> Result<CompatDecision, SecurityReasonCode> {
    match version {
        EnvelopeVersion::Legacy => Ok(CompatDecision {
            path: "legacy",
            reason: None,
        }),
        EnvelopeVersion::V090X3DR if x3dh_enabled => Ok(CompatDecision {
            path: "v090_x3dr",
            reason: None,
        }),
        EnvelopeVersion::V090X3DR => Err(SecurityReasonCode::UnsupportedToken),
    }
}

