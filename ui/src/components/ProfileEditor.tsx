import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import './ProfileEditor.css';

interface Profile {
  nickname: string;
  bio: string | null;
}

interface Props {
  profile: Profile;
  onClose: () => void;
  onSave: (updatedProfile: Profile) => void;
}

export function ProfileEditor({ profile, onClose, onSave }: Props) {
  const { client } = useHolochain();
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const nicknameChanged = nickname !== profile.nickname;
    const bioChanged = bio !== (profile.bio || '');
    setHasChanges(nicknameChanged || bioChanged);
  }, [nickname, bio, profile]);

  const handleSave = async () => {
    if (!client) return;

    if (nickname.trim().length < 2) {
      setError('Nickname must be at least 2 characters');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'update_profile',
        payload: {
          nickname: nickname.trim(),
          bio: bio.trim() || null,
        },
      });

      const updatedProfile: Profile = {
        nickname: nickname.trim(),
        bio: bio.trim() || null,
      };

      onSave(updatedProfile);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="profile-editor-overlay" onClick={handleBackdropClick}>
      <div className="profile-editor">
        <header className="editor-header">
          <h2>✏️ Edit Profile</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="editor-content">
          <div className="avatar-preview">
            <div className="avatar-large">
              {nickname.charAt(0).toUpperCase() || '?'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-nickname">Nickname *</label>
            <input
              id="edit-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
              placeholder="What should neighbors call you?"
            />
            <span className="char-count">{nickname.length}/50</span>
          </div>

          <div className="form-group">
            <label htmlFor="edit-bio">Bio</label>
            <textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell your neighbors a bit about yourself..."
            />
            <span className="char-count">{bio.length}/500</span>
          </div>

          {error && (
            <div className="editor-error">
              ⚠️ {error}
            </div>
          )}
        </div>

        <footer className="editor-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="save-btn" 
            onClick={handleSave}
            disabled={isSaving || !hasChanges || nickname.trim().length < 2}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </footer>
      </div>
    </div>
  );
}
