import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { ProfileForm } from '../components/ProfileForm';
import { ProfileDisplay } from '../components/ProfileDisplay';
import './ProfilePage.css';

export function ProfilePage() {
  const { client, isConnected } = useHolochain();
  const [hasProfile, setHasProfile] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Check if user already has a profile
  useEffect(() => {
    async function checkProfile() {
      if (!client || !isConnected) return;

      try {
        const profile = await client.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_my_profile',
          payload: null,
        });
        setHasProfile(profile !== null);
      } catch (err) {
        console.error('Failed to check profile:', err);
        setHasProfile(false);
      } finally {
        setIsCheckingProfile(false);
      }
    }

    checkProfile();
  }, [client, isConnected]);

  if (isCheckingProfile) {
    return (
      <div className="profile-page">
        <div className="loading">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Account & Profile</h1>
        <p className="page-description">
          Manage your personal information and community presence
        </p>
      </div>
      
      {!hasProfile ? (
        <ProfileForm onProfileCreated={() => setHasProfile(true)} />
      ) : (
        <ProfileDisplay />
      )}
    </div>
  );
}
