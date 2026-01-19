import { useState } from 'react';
import { Space } from './SharedSpaces';
import './CreateSpaceForm.css';

interface CreateSpaceFormProps {
  onSpaceCreated: (space: Omit<Space, 'id'>) => void;
}

const EMOJI_OPTIONS = [
  '🎾', '🏀', '⚽', '🏐', '🏈', '⚾', '🏓', '🏸', '🏒', '🥅',
  '🏕️', '🏖️', '🏞️', '⛺', '🏛️', '🏰', '🏟️', '🎪',
  '🍖', '🔥', '🌱', '🌻', '🌳', '🪴', '🏊', '🎨', '🎭', '📚',
];

const DURATION_PRESETS = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '1 day', value: 1440 },
  { label: '1 week', value: 10080 },
];

export function CreateSpaceForm({ onSpaceCreated }: CreateSpaceFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🏛️');
  const [maxDuration, setMaxDuration] = useState(60);
  const [minDuration, setMinDuration] = useState(30);
  const [subdivisions, setSubdivisions] = useState(1);
  const [subdivisionNames, setSubdivisionNames] = useState<string[]>(['']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || maxDuration < minDuration) {
      return;
    }

    const space: Omit<Space, 'id'> = {
      name: name.trim(),
      description: description.trim(),
      emoji,
      maxDuration,
      minDuration,
      subdivisions,
      subdivisionNames: subdivisions > 1 
        ? subdivisionNames.filter(n => n.trim()).map(n => n.trim())
        : undefined,
    };

    onSpaceCreated(space);

    // Reset form
    setName('');
    setDescription('');
    setEmoji('🏛️');
    setMaxDuration(60);
    setMinDuration(30);
    setSubdivisions(1);
    setSubdivisionNames(['']);
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setEmoji('🏛️');
    setMaxDuration(60);
    setMinDuration(30);
    setSubdivisions(1);
    setSubdivisionNames(['']);
    setIsExpanded(false);
  };

  const handleSubdivisionsChange = (count: number) => {
    setSubdivisions(count);
    if (count > 1) {
      const newNames = Array(count).fill('').map((_, i) => 
        subdivisionNames[i] || `Area ${i + 1}`
      );
      setSubdivisionNames(newNames);
    } else {
      setSubdivisionNames(['']);
    }
  };

  const updateSubdivisionName = (index: number, value: string) => {
    const newNames = [...subdivisionNames];
    newNames[index] = value;
    setSubdivisionNames(newNames);
  };

  if (!isExpanded) {
    return (
      <button
        className="create-space-trigger"
        onClick={() => setIsExpanded(true)}
      >
        <span className="trigger-icon">+</span>
        <span>Add New Shared Space</span>
      </button>
    );
  }

  return (
    <form className="create-space-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h3>Add New Shared Space</h3>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="space-name">Space Name *</label>
          <input
            id="space-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Tennis Courts"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="space-emoji">Icon *</label>
          <select
            id="space-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="emoji-select"
          >
            {EMOJI_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e} {e}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="space-description">Description</label>
        <textarea
          id="space-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the space and any rules..."
          rows={2}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="min-duration">Minimum Duration *</label>
          <select
            id="min-duration"
            value={minDuration}
            onChange={(e) => setMinDuration(Number(e.target.value))}
            required
          >
            {DURATION_PRESETS.map((preset) => (
              <option key={`min-${preset.value}`} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="max-duration">Maximum Duration *</label>
          <select
            id="max-duration"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
            required
          >
            {DURATION_PRESETS.map((preset) => (
              <option key={`max-${preset.value}`} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="subdivisions">Number of Subdivisions</label>
        <input
          id="subdivisions"
          type="number"
          min="1"
          max="10"
          value={subdivisions}
          onChange={(e) => handleSubdivisionsChange(Number(e.target.value))}
        />
        <p className="field-hint">
          Set to 1 for no subdivisions, or higher to allow partial reservations
        </p>
      </div>

      {subdivisions > 1 && (
        <div className="subdivisions-section">
          <label>Subdivision Names</label>
          <div className="subdivision-inputs">
            {subdivisionNames.map((subName, index) => (
              <input
                key={index}
                type="text"
                value={subName}
                onChange={(e) => updateSubdivisionName(index, e.target.value)}
                placeholder={`Area ${index + 1}`}
                className="subdivision-input"
              />
            ))}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button 
          type="submit" 
          className="submit-btn"
          disabled={maxDuration < minDuration}
        >
          Add Space
        </button>
      </div>

      {maxDuration < minDuration && (
        <p className="error-hint">Maximum duration must be greater than or equal to minimum duration</p>
      )}
    </form>
  );
}
