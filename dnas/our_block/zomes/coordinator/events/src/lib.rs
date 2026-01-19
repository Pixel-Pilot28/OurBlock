//! Events Coordinator Zome
//!
//! This zome implements the business logic for neighborhood events.
//! Users can create events, RSVP, and manage attendee lists.

use hdk::prelude::*;
use events_integrity::*;

/// Signal types for real-time updates
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum Signal {
    NewEvent { event_hash: ActionHash, event: Event },
    EventRSVP { event_hash: ActionHash, attendee: AgentPubKey },
}

/// Input for creating an event
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateEventInput {
    pub title: String,
    pub description: String,
    pub location: String,
    pub event_date: Timestamp,
    pub max_attendees: Option<u32>,
}

/// Output for event operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EventOutput {
    pub event: Event,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

const ALL_EVENTS_PATH: &str = "all_events";

// ============================================================================
// EVENT MANAGEMENT
// ============================================================================

/// Create a new event
#[hdk_extern]
pub fn create_event(input: CreateEventInput) -> ExternResult<EventOutput> {
    let host = agent_info()?.agent_initial_pubkey;
    
    let event = Event {
        title: input.title,
        description: input.description,
        location: input.location,
        event_date: input.event_date,
        host: host.clone(),
        attendees: vec![host.clone()], // Host is automatically attending
        max_attendees: input.max_attendees,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Event(event.clone()))?;
    let entry_hash = hash_entry(&event)?;
    
    // Link from host to event
    create_link(
        host.clone(),
        action_hash.clone(),
        LinkTypes::AgentToEvents,
        (),
    )?;
    
    // Link from host to attending (they're auto-attending)
    create_link(
        host,
        action_hash.clone(),
        LinkTypes::AgentToAttendingEvents,
        (),
    )?;
    
    // Link to global all_events anchor
    let all_events_anchor = all_events_anchor_hash()?;
    create_link(
        all_events_anchor,
        action_hash.clone(),
        LinkTypes::AllEvents,
        (),
    )?;
    
    // Emit signal for real-time updates
    emit_signal(Signal::NewEvent {
        event_hash: action_hash.clone(),
        event: event.clone(),
    })?;
    
    Ok(EventOutput {
        event,
        action_hash,
        entry_hash,
    })
}

/// Get all events
#[hdk_extern]
pub fn get_all_events(_: ()) -> ExternResult<Vec<EventOutput>> {
    let all_events_anchor = all_events_anchor_hash()?;
    
    let links = get_links(
        LinkQuery::try_new(all_events_anchor, LinkTypes::AllEvents)?,
        GetStrategy::Local,
    )?;
    
    let mut events = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(event) = record.entry().to_app_option::<Event>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
                {
                    let entry_hash = hash_entry(&event)?;
                    events.push(EventOutput {
                        event,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    // Sort by event_date ascending (upcoming first)
    events.sort_by(|a, b| a.event.event_date.cmp(&b.event.event_date));
    
    Ok(events)
}

/// RSVP to an event
#[hdk_extern]
pub fn rsvp_event(event_hash: ActionHash) -> ExternResult<EventOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    // Get the current event
    let Some(record) = get(event_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Event not found".into())));
    };
    
    let Some(mut event) = record.entry().to_app_option::<Event>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest("Invalid event entry".into())));
    };
    
    // Check if already attending
    if event.attendees.contains(&agent) {
        return Err(wasm_error!(WasmErrorInner::Guest("Already attending this event".into())));
    }
    
    // Check max attendees
    if let Some(max) = event.max_attendees {
        if event.attendees.len() >= max as usize {
            return Err(wasm_error!(WasmErrorInner::Guest("Event is full".into())));
        }
    }
    
    // Add attendee
    event.attendees.push(agent.clone());
    
    // Update the event
    let new_action_hash = update_entry(event_hash.clone(), &event)?;
    let entry_hash = hash_entry(&event)?;
    
    // Create link from agent to attending events
    create_link(
        agent.clone(),
        new_action_hash.clone(),
        LinkTypes::AgentToAttendingEvents,
        (),
    )?;
    
    // Emit signal for real-time updates
    emit_signal(Signal::EventRSVP {
        event_hash: new_action_hash.clone(),
        attendee: agent,
    })?;
    
    Ok(EventOutput {
        event,
        action_hash: new_action_hash,
        entry_hash,
    })
}

/// Cancel RSVP to an event
#[hdk_extern]
pub fn cancel_rsvp(event_hash: ActionHash) -> ExternResult<EventOutput> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    // Get the current event
    let Some(record) = get(event_hash.clone(), GetOptions::default())? else {
        return Err(wasm_error!(WasmErrorInner::Guest("Event not found".into())));
    };
    
    let Some(mut event) = record.entry().to_app_option::<Event>()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
    else {
        return Err(wasm_error!(WasmErrorInner::Guest("Invalid event entry".into())));
    };
    
    // Check if host (can't cancel own event)
    if event.host == agent {
        return Err(wasm_error!(WasmErrorInner::Guest("Host cannot cancel RSVP, delete the event instead".into())));
    }
    
    // Remove from attendees
    event.attendees.retain(|a| a != &agent);
    
    // Update the event
    let new_action_hash = update_entry(event_hash, &event)?;
    let entry_hash = hash_entry(&event)?;
    
    Ok(EventOutput {
        event,
        action_hash: new_action_hash,
        entry_hash,
    })
}

/// Get events the calling agent is attending
#[hdk_extern]
pub fn get_my_events(_: ()) -> ExternResult<Vec<EventOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let links = get_links(
        LinkQuery::try_new(agent, LinkTypes::AgentToAttendingEvents)?,
        GetStrategy::Local,
    )?;
    
    let mut events = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(event) = record.entry().to_app_option::<Event>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
                {
                    let entry_hash = hash_entry(&event)?;
                    events.push(EventOutput {
                        event,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    events.sort_by(|a, b| a.event.event_date.cmp(&b.event.event_date));
    
    Ok(events)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn all_events_anchor_hash() -> ExternResult<EntryHash> {
    let path = Path::from(ALL_EVENTS_PATH);
    path.path_entry_hash()
}
