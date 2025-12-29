import { useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import type { ItemOutput } from '../types';
import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '../types';
import './AddItemForm.css';

interface Props {
  onItemAdded: (item: ItemOutput) => void;
  onCancel: () => void;
}

export function AddItemForm({ onItemAdded, onCancel }: Props) {
  const { client } = useHolochain();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = title.trim().length > 0 && title.length <= MAX_TITLE_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!client || !isValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'create_item',
        payload: {
          title: title.trim(),
          description: description.trim(),
          image_hash: null,
        },
      });

      onItemAdded(result);
    } catch (err) {
      console.error('Failed to add item:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-item-form">
      <form onSubmit={handleSubmit}>
        <div className="form-header">
          <h3>➕ Add New Item</h3>
          <p>Share something with your neighbors</p>
        </div>

        <div className="form-group">
          <label htmlFor="item-title">Item Name *</label>
          <input
            type="text"
            id="item-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Electric Drill, Board Game, Ladder..."
            maxLength={MAX_TITLE_LENGTH}
            autoFocus
          />
          <div className="field-info">
            <span></span>
            <span className="char-count">{title.length}/{MAX_TITLE_LENGTH}</span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="item-description">Description</label>
          <textarea
            id="item-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the item, its condition, any instructions..."
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={4}
          />
          <div className="field-info">
            <span></span>
            <span className="char-count">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </div>
        </div>

        {error && (
          <div className="form-error">
            ⚠️ {error}
          </div>
        )}

        <div className="form-actions">
          <button 
            type="button" 
            className="cancel-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add to Tool Shed'}
          </button>
        </div>
      </form>
    </div>
  );
}
