use hdi::prelude::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub sender: AgentPubKey,
    pub content: String,
    pub timestamp: i64,
    pub message_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatSignal {
    Message(ChatMessage),
    Typing { sender: AgentPubKey },
    Read { sender: AgentPubKey, message_id: String },
    Online { agent: AgentPubKey },
    Offline { agent: AgentPubKey },
}

pub const MAX_MESSAGE_LENGTH: usize = 5000;

#[hdk_link_types]
pub enum LinkTypes {
    OnlineAgents,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct ChatPresence {
    pub agent: AgentPubKey,
    pub online: bool,
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(name = "chat_presence", visibility = "public")]
    ChatPresence(ChatPresence),
}

#[hdk_extern]
pub fn validate(_op: Op) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
