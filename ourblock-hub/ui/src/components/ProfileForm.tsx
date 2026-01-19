import { useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import './ProfileForm.css';

interface Props {
  onProfileCreated: () => void;
}

export function ProfileForm({ onProfileCreated }: Props) {
  const { client } = useHolochain();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [locationMetadata, setLocationMetadata] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) {
      setError('Not connected to Holochain');
      return;
    }

    if (nickname.trim().length < 2) {
      setError('Nickname must be at least 2 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'create_profile',
        payload: {
          nickname: nickname.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          location_metadata: locationMetadata.trim() || null,
        },
      });

      onProfileCreated();
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create profile'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-form-container">
      <h2>Welcome to OurBlock! 👋</h2>
      <p className="form-intro">
        Create your neighbor profile to get started. This is how others in your
        block will know you.
      </p>

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-group">
          <label htmlFor="nickname">Nickname *</label>
          <input
            type="text"
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="What should neighbors call you?"
            maxLength={50}
            required
          />
          <span className="char-count">{nickname.length}/50</span>
        </div>

        <div className="form-group">
          <label htmlFor="bio">Bio (optional)</label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell your neighbors a bit about yourself..."
            maxLength={500}
            rows={4}
          />
          <span className="char-count">{bio.length}/500</span>
        </div>

        <div className="form-group">
          <label htmlFor="avatarUrl">Avatar URL (optional)</label>
          <input
            type="url"
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            maxLength={500}
          />
          <span className="field-hint">Link to your profile picture</span>
        </div>

        <div className="form-group">
          <label htmlFor="locationMetadata">Location (optional)</label>
          <input
            type="text"
            id="locationMetadata"
            value={locationMetadata}
            onChange={(e) => setLocationMetadata(e.target.value)}
            placeholder="e.g., Building A, Apt 301"
            maxLength={200}
          />
          <span className="field-hint">Your address or unit within the neighborhood</span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={isSubmitting || nickname.trim().length < 2}>
          {isSubmitting ? 'Creating...' : 'Join OurBlock'}
        </button>
      </form>
    </div>
  );
}
