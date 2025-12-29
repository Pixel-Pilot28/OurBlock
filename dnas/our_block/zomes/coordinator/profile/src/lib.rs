//! Profile Coordinator Zome
//!
//! This zome implements the business logic for managing user profiles.
//! It uses the types and validation rules defined in profile_integrity.

use hdk::prelude::*;
use profile_integrity::*;

/// Input for creating or updating a profile
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateProfileInput {
    pub nickname: String,
    pub bio: Option<String>,
}

/// Profile with additional metadata for the frontend
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProfileOutput {
    pub profile: Profile,
    pub action_hash: ActionHash,
    pub entry_hash: EntryHash,
    pub agent: AgentPubKey,
}

/// Anchor path for listing all profiles
const ALL_PROFILES_ANCHOR: &str = "all_profiles";

/// Creates a new profile for the calling agent
///
/// Each agent can only have one profile. If a profile already exists,
/// this will return an error. Use `update_profile` to modify an existing profile.
#[hdk_extern]
pub fn create_profile(input: CreateProfileInput) -> ExternResult<ProfileOutput> {
    let agent = agent_info()?.agent_initial_pubkey;

    // Check if profile already exists
    let existing = get_profile_for_agent(agent.clone())?;
    if existing.is_some() {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "Profile already exists. Use update_profile to modify it.".to_string()
        )));
    }

    // Create the profile entry
    let profile = Profile {
        nickname: input.nickname,
        bio: input.bio,
        created_at: sys_time()?,
    };

    let action_hash = create_entry(EntryTypes::Profile(profile.clone()))?;
    let entry_hash = hash_entry(&profile)?;

    // Link agent to their profile
    create_link(
        agent.clone(),
        entry_hash.clone(),
        LinkTypes::AgentToProfile,
        (),
    )?;

    // Link to all_profiles anchor for discovery
    let anchor_hash = anchor_hash()?;
    create_link(anchor_hash, entry_hash.clone(), LinkTypes::AllProfiles, ())?;

    Ok(ProfileOutput {
        profile,
        action_hash,
        entry_hash,
        agent,
    })
}

/// Updates the calling agent's profile
#[hdk_extern]
pub fn update_profile(input: CreateProfileInput) -> ExternResult<ProfileOutput> {
    let agent = agent_info()?.agent_initial_pubkey;

    // Get existing profile
    let existing = get_profile_for_agent(agent.clone())?
        .ok_or_else(|| wasm_error!(WasmErrorInner::Guest("No profile exists to update.".to_string())))?;

    // Create updated profile
    let profile = Profile {
        nickname: input.nickname,
        bio: input.bio,
        created_at: sys_time()?,
    };

    let action_hash = update_entry(existing.action_hash.clone(), &profile)?;
    let entry_hash = hash_entry(&profile)?;

    // Delete old link and create new one
    let links = get_links(
        GetLinksInputBuilder::try_new(agent.clone(), LinkTypes::AgentToProfile)?.build(),
    )?;
    
    for link in links {
        delete_link(link.create_link_hash)?;
    }

    create_link(
        agent.clone(),
        entry_hash.clone(),
        LinkTypes::AgentToProfile,
        (),
    )?;

    Ok(ProfileOutput {
        profile,
        action_hash,
        entry_hash,
        agent,
    })
}

/// Gets the profile for the calling agent
#[hdk_extern]
pub fn get_my_profile(_: ()) -> ExternResult<Option<ProfileOutput>> {
    let agent = agent_info()?.agent_initial_pubkey;
    get_profile_for_agent(agent)
}

/// Gets the profile for a specific agent
#[hdk_extern]
pub fn get_agent_profile(agent: AgentPubKey) -> ExternResult<Option<ProfileOutput>> {
    get_profile_for_agent(agent)
}

/// Internal helper to get a profile for an agent
fn get_profile_for_agent(agent: AgentPubKey) -> ExternResult<Option<ProfileOutput>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(agent.clone(), LinkTypes::AgentToProfile)?.build(),
    )?;

    let Some(link) = links.into_iter().next() else {
        return Ok(None);
    };

    let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
        wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
    })?;

    // Get the latest record for this entry
    let Some(record) = get(entry_hash.clone(), GetOptions::default())? else {
        return Ok(None);
    };

    let profile: Profile = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
        .ok_or_else(|| wasm_error!(WasmErrorInner::Guest("Profile entry not found".to_string())))?;

    Ok(Some(ProfileOutput {
        profile,
        action_hash: record.action_address().clone(),
        entry_hash,
        agent,
    }))
}

/// Gets all profiles in the neighborhood
#[hdk_extern]
pub fn get_all_profiles(_: ()) -> ExternResult<Vec<ProfileOutput>> {
    let anchor_hash = anchor_hash()?;
    let links = get_links(
        GetLinksInputBuilder::try_new(anchor_hash, LinkTypes::AllProfiles)?.build(),
    )?;

    let mut profiles = Vec::new();

    for link in links {
        let entry_hash = EntryHash::try_from(link.target).map_err(|_| {
            wasm_error!(WasmErrorInner::Guest("Invalid entry hash in link".to_string()))
        })?;

        if let Some(record) = get(entry_hash.clone(), GetOptions::default())? {
            if let Some(profile) = record
                .entry()
                .to_app_option::<Profile>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                // Get the agent from the record's author
                let agent = record.action().author().clone();
                profiles.push(ProfileOutput {
                    profile,
                    action_hash: record.action_address().clone(),
                    entry_hash,
                    agent,
                });
            }
        }
    }

    Ok(profiles)
}

/// Creates a deterministic anchor hash for all profiles
fn anchor_hash() -> ExternResult<EntryHash> {
    // Use a simple path-based anchor
    let path = Path::from(ALL_PROFILES_ANCHOR);
    path.path_entry_hash()
}
