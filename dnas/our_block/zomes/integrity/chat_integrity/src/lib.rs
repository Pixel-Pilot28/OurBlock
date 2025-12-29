use hdi::prelude::*;

/// ───────────────────────────────────────────────────────────────────────────
/// SIGNAL TYPES (for ephemeral messaging - not stored in DHT)
/// ───────────────────────────────────────────────────────────────────────────

/// The signal payload sent between agents
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub sender: AgentPubKey,
    pub content: String,
    pub timestamp: i64, // milliseconds since epoch
    pub message_id: String, // UUID for deduplication
}

/// Signal types that can be sent/received
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatSignal {
    /// A direct message from another agent
    Message(ChatMessage),
    /// Typing indicator
    Typing { sender: AgentPubKey },
    /// Read receipt
    Read { sender: AgentPubKey, message_id: String },
    /// Agent came online
    Online { agent: AgentPubKey },
    /// Agent went offline
    Offline { agent: AgentPubKey },
}

/// Validation constants
pub const MAX_MESSAGE_LENGTH: usize = 5000;

/// ───────────────────────────────────────────────────────────────────────────
/// LINK TYPES (minimal - just for presence tracking)
/// ───────────────────────────────────────────────────────────────────────────

#[hdk_link_types]
pub enum LinkTypes {
    /// Online agents anchor -> Agent (for presence)
    OnlineAgents,
}

/// ───────────────────────────────────────────────────────────────────────────
/// ENTRY DEFS (none for ephemeral chat - signals only)
/// ───────────────────────────────────────────────────────────────────────────

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {}

/// ───────────────────────────────────────────────────────────────────────────
/// VALIDATION (minimal for signal-only zome)
/// ───────────────────────────────────────────────────────────────────────────

#[hdk_extern]
pub fn validate(_op: Op) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
