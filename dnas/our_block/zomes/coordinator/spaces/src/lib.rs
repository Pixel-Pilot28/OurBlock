//! Shared Spaces Coordinator Zome
//!
//! This zome implements the business logic for managing shared community spaces
//! and their reservations.

use hdk::prelude::*;
use spaces_integrity::*;

/// Signal types for real-time updates
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum Signal {
    NewSpace { space_hash: ActionHash, space: Space },
    NewReservation { space_hash: ActionHash, reservation_hash: ActionHash },
}

/// Input for creating a space
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateSpaceInput {
    pub name: String,
    pub description: String,
    pub capacity: u32,
    pub available_hours: String,
}

/// Output for space operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SpaceOutput {
    pub space: Space,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

/// Input for creating a reservation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateReservationInput {
    pub space_hash: ActionHash,
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub purpose: Option<String>,
}

/// Output for reservation operations
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReservationOutput {
    pub reservation: Reservation,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
}

const ALL_SPACES_PATH: &str = "all_spaces";

// ============================================================================
// SPACE MANAGEMENT
// ============================================================================

/// Create a new shared space
#[hdk_extern]
pub fn create_space(input: CreateSpaceInput) -> ExternResult<SpaceOutput> {
    let manager = agent_info()?.agent_initial_pubkey;
    
    let space = Space {
        name: input.name,
        description: input.description,
        capacity: input.capacity,
        available_hours: input.available_hours,
        manager: manager.clone(),
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Space(space.clone()))?;
    let entry_hash = hash_entry(&space)?;
    
    // Link from manager to space
    create_link(
        manager,
        action_hash.clone(),
        LinkTypes::AgentToSpaces,
        (),
    )?;
    
    // Link to global all_spaces anchor
    let all_spaces_anchor = all_spaces_anchor_hash()?;
    create_link(
        all_spaces_anchor,
        action_hash.clone(),
        LinkTypes::AllSpaces,
        (),
    )?;
    
    // Emit signal for real-time updates
    emit_signal(Signal::NewSpace {
        space_hash: action_hash.clone(),
        space: space.clone(),
    })?;
    
    Ok(SpaceOutput {
        space,
        action_hash,
        entry_hash,
    })
}

/// Get all shared spaces
#[hdk_extern]
pub fn get_all_spaces(_: ()) -> ExternResult<Vec<SpaceOutput>> {
    let all_spaces_anchor = all_spaces_anchor_hash()?;
    
    let links = get_links(
        LinkQuery::try_new(all_spaces_anchor, LinkTypes::AllSpaces)?,
        GetStrategy::Local,
    )?;
    
    let mut spaces = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(space) = record.entry().to_app_option::<Space>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
                {
                    let entry_hash = hash_entry(&space)?;
                    spaces.push(SpaceOutput {
                        space,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    // Sort by name
    spaces.sort_by(|a, b| a.space.name.cmp(&b.space.name));
    
    Ok(spaces)
}

// ============================================================================
// RESERVATION MANAGEMENT
// ============================================================================

/// Create a reservation for a space
#[hdk_extern]
pub fn create_reservation(input: CreateReservationInput) -> ExternResult<ReservationOutput> {
    let reserver = agent_info()?.agent_initial_pubkey;
    
    // Check for conflicts with existing reservations
    let existing_reservations = get_space_reservations(input.space_hash.clone())?;
    
    for res_output in existing_reservations {
        let res = res_output.reservation;
        // Check if times overlap
        if !(input.end_time <= res.start_time || input.start_time >= res.end_time) {
            return Err(wasm_error!(WasmErrorInner::Guest(
                "Time slot conflicts with existing reservation".into()
            )));
        }
    }
    
    let reservation = Reservation {
        space_hash: input.space_hash.clone(),
        reserver: reserver.clone(),
        start_time: input.start_time,
        end_time: input.end_time,
        purpose: input.purpose,
        created_at: sys_time()?,
    };
    
    let action_hash = create_entry(EntryTypes::Reservation(reservation.clone()))?;
    let entry_hash = hash_entry(&reservation)?;
    
    // Link from space to reservation
    create_link(
        input.space_hash.clone(),
        action_hash.clone(),
        LinkTypes::SpaceToReservations,
        (),
    )?;
    
    // Link from agent to reservation
    create_link(
        reserver,
        action_hash.clone(),
        LinkTypes::AgentToReservations,
        (),
    )?;
    
    // Emit signal for real-time updates
    emit_signal(Signal::NewReservation {
        space_hash: input.space_hash,
        reservation_hash: action_hash.clone(),
    })?;
    
    Ok(ReservationOutput {
        reservation,
        action_hash,
        entry_hash,
    })
}

/// Get all reservations for a space
#[hdk_extern]
pub fn get_space_reservations(space_hash: ActionHash) -> ExternResult<Vec<ReservationOutput>> {
    let links = get_links(
        LinkQuery::try_new(space_hash, LinkTypes::SpaceToReservations)?,
        GetStrategy::Local,
    )?;
    
    let mut reservations = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(reservation) = record.entry().to_app_option::<Reservation>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
                {
                    let entry_hash = hash_entry(&reservation)?;
                    reservations.push(ReservationOutput {
                        reservation,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    // Sort by start_time
    reservations.sort_by(|a, b| a.reservation.start_time.cmp(&b.reservation.start_time));
    
    Ok(reservations)
}

/// Get all reservations for the calling agent
#[hdk_extern]
pub fn get_my_reservations(_: ()) -> ExternResult<Vec<ReservationOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    
    let links = get_links(
        LinkQuery::try_new(agent, LinkTypes::AgentToReservations)?,
        GetStrategy::Local,
    )?;
    
    let mut reservations = Vec::new();
    
    for link in links {
        if let Some(action_hash) = link.target.into_action_hash() {
            if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
                if let Some(reservation) = record.entry().to_app_option::<Reservation>()
                    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
                {
                    let entry_hash = hash_entry(&reservation)?;
                    reservations.push(ReservationOutput {
                        reservation,
                        action_hash,
                        entry_hash,
                    });
                }
            }
        }
    }
    
    reservations.sort_by(|a, b| a.reservation.start_time.cmp(&b.reservation.start_time));
    
    Ok(reservations)
}

/// Cancel a reservation
#[hdk_extern]
pub fn cancel_reservation(reservation_hash: ActionHash) -> ExternResult<()> {
    delete_entry(reservation_hash)?;
    Ok(())
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn all_spaces_anchor_hash() -> ExternResult<EntryHash> {
    let path = Path::from(ALL_SPACES_PATH);
    path.path_entry_hash()
}
