use hdk::prelude::*;
use chat_integrity::*;

/// ───────────────────────────────────────────────────────────────────────────
/// SIGNAL INPUT/OUTPUT TYPES
/// ───────────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SendMessageInput {
    pub recipient: AgentPubKey,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SendMessageOutput {
    pub message_id: String,
    pub timestamp: i64,
    pub success: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SendTypingInput {
    pub recipient: AgentPubKey,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SendReadReceiptInput {
    pub recipient: AgentPubKey,
    pub message_id: String,
}

/// ───────────────────────────────────────────────────────────────────────────
/// ANCHOR HELPERS
/// ───────────────────────────────────────────────────────────────────────────

fn online_agents_anchor() -> ExternResult<EntryHash> {
    // Use a ChatPresence entry as the anchor
    let presence = ChatPresence {
        agent: AgentPubKey::from_raw_36(vec![0u8; 36]),
        online: false,
    };
    hash_entry(&presence)
}

/// ───────────────────────────────────────────────────────────────────────────
/// EPHEMERAL MESSAGING FUNCTIONS
/// ───────────────────────────────────────────────────────────────────────────

/// Send an ephemeral message to a specific agent
/// This uses send_remote_signal - message is NOT stored in the DHT
#[hdk_extern]
pub fn send_message(input: SendMessageInput) -> ExternResult<SendMessageOutput> {
    // Validate message length
    if input.message.trim().is_empty() {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Message cannot be empty".to_string()
        )));
    }
    if input.message.len() > MAX_MESSAGE_LENGTH {
        return Err(wasm_error!(WasmErrorInner::Guest(format!(
            "Message cannot exceed {} characters",
            MAX_MESSAGE_LENGTH
        ))));
    }

    let sender = agent_info()?.agent_initial_pubkey;
    let timestamp = sys_time()?.as_millis() as i64;
    
    // Generate a unique message ID
    let rand_bytes = random_bytes(4)?;
    let rand_hex: String = rand_bytes.iter().map(|b| format!("{:02x}", b)).collect();
    let message_id = format!(
        "{}-{}-{}",
        hex_encode(sender.get_raw_36()),
        timestamp,
        rand_hex
    );

    let chat_message = ChatMessage {
        sender: sender.clone(),
        content: input.message,
        timestamp,
        message_id: message_id.clone(),
    };

    let signal = ChatSignal::Message(chat_message);

    // Send remote signal to recipient (ephemeral, not stored)
    send_remote_signal(signal, vec![input.recipient])?;

    Ok(SendMessageOutput {
        message_id,
        timestamp,
        success: true,
    })
}

/// Send typing indicator to a specific agent
#[hdk_extern]
pub fn send_typing(input: SendTypingInput) -> ExternResult<()> {
    let sender = agent_info()?.agent_initial_pubkey;
    
    let signal = ChatSignal::Typing { sender };
    send_remote_signal(signal, vec![input.recipient])?;
    
    Ok(())
}

/// Send read receipt to a specific agent
#[hdk_extern]
pub fn send_read_receipt(input: SendReadReceiptInput) -> ExternResult<()> {
    let sender = agent_info()?.agent_initial_pubkey;
    
    let signal = ChatSignal::Read {
        sender,
        message_id: input.message_id,
    };
    send_remote_signal(signal, vec![input.recipient])?;
    
    Ok(())
}

/// Announce that this agent is online (broadcasts to known agents)
#[hdk_extern]
pub fn announce_online(agents: Vec<AgentPubKey>) -> ExternResult<()> {
    let me = agent_info()?.agent_initial_pubkey;
    
    // Add self to online agents anchor
    let anchor = online_agents_anchor()?;
    create_link(anchor, me.clone(), LinkTypes::OnlineAgents, ())?;
    
    // Notify specified agents
    if !agents.is_empty() {
        let signal = ChatSignal::Online { agent: me };
        send_remote_signal(signal, agents)?;
    }
    
    Ok(())
}

/// Announce that this agent is going offline
#[hdk_extern]
pub fn announce_offline(agents: Vec<AgentPubKey>) -> ExternResult<()> {
    let me = agent_info()?.agent_initial_pubkey;
    
    if !agents.is_empty() {
        let signal = ChatSignal::Offline { agent: me };
        send_remote_signal(signal, agents)?;
    }
    
    Ok(())
}

/// Get list of online agents
#[hdk_extern]
pub fn get_online_agents(_: ()) -> ExternResult<Vec<AgentPubKey>> {
    let anchor = online_agents_anchor()?;
    let links = get_links(
        LinkQuery::try_new(anchor, LinkTypes::OnlineAgents)?,
        GetStrategy::Local,
    )?;
    
    let agents: Vec<AgentPubKey> = links
        .into_iter()
        .filter_map(|link| AgentPubKey::try_from(link.target).ok())
        .collect();
    
    Ok(agents)
}

/// Get my agent public key (for UI to know who I am)
#[hdk_extern]
pub fn get_my_agent_key(_: ()) -> ExternResult<AgentPubKey> {
    Ok(agent_info()?.agent_initial_pubkey)
}

/// ───────────────────────────────────────────────────────────────────────────
/// SIGNAL CALLBACK
/// ───────────────────────────────────────────────────────────────────────────

/// Handle incoming remote signals and emit them locally to the UI
#[hdk_extern]
pub fn recv_remote_signal(signal: ExternIO) -> ExternResult<()> {
    // Decode the incoming signal
    let chat_signal: ChatSignal = signal.decode().map_err(|e| {
        wasm_error!(WasmErrorInner::Guest(format!(
            "Failed to decode chat signal: {:?}",
            e
        )))
    })?;

    // Emit as a local signal for the UI to receive
    emit_signal(chat_signal)?;

    Ok(())
}

/// ───────────────────────────────────────────────────────────────────────────
/// HELPERS
/// ───────────────────────────────────────────────────────────────────────────

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().take(8).map(|b| format!("{:02x}", b)).collect()
}
