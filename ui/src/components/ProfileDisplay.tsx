import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import './ProfileDisplay.css';

interface Profile {
  nickname: string;
  bio: string | null;
  created_at: number;
}

interface ProfileOutput {
  profile: Profile;
  action_hash: Uint8Array;
  entry_hash: Uint8Array;
  agent: Uint8Array;
}

export function ProfileDisplay() {
  const { client } = useHolochain();
  const [profile, setProfile] = useState<ProfileOutput | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfiles() {
      if (!client) return;

      try {
        // Load my profile
        const myProfile = await client.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_my_profile',
          payload: null,
        });
        setProfile(myProfile);

        // Load all profiles
        const profiles = await client.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_all_profiles',
          payload: null,
        });
        setAllProfiles(profiles);
      } catch (err) {
        console.error('Failed to load profiles:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load profiles'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadProfiles();
  }, [client]);

  if (isLoading) {
    return (
      <div className="profile-display loading">
        <p>Loading your neighborhood...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-display error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="profile-display">
      {profile && (
        <section className="my-profile">
          <h2>Your Profile</h2>
          <div className="profile-card">
            <div className="profile-avatar">
              {profile.profile.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <h3>{profile.profile.nickname}</h3>
              {profile.profile.bio && <p>{profile.profile.bio}</p>}
            </div>
          </div>
        </section>
      )}

      <section className="neighbors">
        <h2>Your Neighbors ({allProfiles.length})</h2>
        {allProfiles.length === 0 ? (
          <p className="no-neighbors">
            You're the first one here! Invite your neighbors to join.
          </p>
        ) : (
          <div className="neighbors-grid">
            {allProfiles.map((neighbor, index) => (
              <div key={index} className="neighbor-card">
                <div className="profile-avatar">
                  {neighbor.profile.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="profile-info">
                  <h4>{neighbor.profile.nickname}</h4>
                  {neighbor.profile.bio && (
                    <p className="neighbor-bio">{neighbor.profile.bio}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
