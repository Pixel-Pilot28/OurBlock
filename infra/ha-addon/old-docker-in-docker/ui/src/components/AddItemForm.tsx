import { useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { ImageUploadCrop } from './ImageUploadCrop';
import type { ItemOutput } from '../types';
import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from '../types/toolshed';
import './AddItemForm.css';

interface Props {
  onItemAdded: (newItem?: ItemOutput) => void;
  onCancel: () => void;
}

export function AddItemForm({ onItemAdded, onCancel }: Props) {
  const { client } = useHolochain();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemImage, setItemImage] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [consumables, setConsumables] = useState<Array<{ name: string; included: boolean }>>([]);
  const [newConsumable, setNewConsumable] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image is optional since file_storage is disabled
  const isValid = title.trim().length > 0 && title.length <= MAX_TITLE_LENGTH;

  const addConsumable = () => {
    if (!newConsumable.trim()) return;
    setConsumables([...consumables, { name: newConsumable.trim(), included: true }]);
    setNewConsumable('');
  };

  const toggleConsumable = (index: number) => {
    const updated = [...consumables];
    updated[index].included = !updated[index].included;
    setConsumables(updated);
  };

  const removeConsumable = (index: number) => {
    setConsumables(consumables.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!client || !isValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let imageHash = null;

      if (itemImage) {
        const base64Data = itemImage.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const fileResult = await client.callZome({
          role_name: 'our_block',
          zome_name: 'file_storage',
          fn_name: 'upload_file',
          payload: { name: `${title.trim()}.jpg`, file_type: 'image/jpeg', data: Array.from(bytes) },
        });
        imageHash = fileResult.metadata_hash;
      }

      const createdItem: ItemOutput = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'create_item',
        payload: {
          title: title.trim(),
          description: description.trim(),
          image_hash: imageHash,
          consumables: consumables,
          notes: notes,
        },
      });

      // Notify parent that item was added (just close modal and reload)
      onItemAdded(createdItem);
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
          <label>Item Photo *</label>
          <ImageUploadCrop 
            onImageSelected={setItemImage}
            aspectRatio={4 / 3}
          />
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

        <div className="form-group">
          <label htmlFor="item-notes">Notes for Borrowers</label>
          <textarea
            id="item-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add instructions, warnings, or tips for borrowers..."
            maxLength={500}
            rows={3}
          />
          <div className="field-info">
            <span></span>
            <span className="char-count">{notes.length}/500</span>
          </div>
        </div>

        <div className="form-group">
          <label>Consumables & Accessories</label>
          <p className="field-hint">List items needed for this tool and whether they're included with the rental</p>
          
          {consumables.length > 0 && (
            <div className="consumables-list">
              {consumables.map((consumable, index) => (
                <div key={index} className="consumable-item">
                  <span className="consumable-name">{consumable.name}</span>
                  <div className="consumable-status">
                    <button
                      type="button"
                      className={`status-toggle ${consumable.included ? 'included' : 'not-included'}`}
                      onClick={() => toggleConsumable(index)}
                    >
                      {consumable.included ? '✓ Included' : '✗ Not Included'}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="remove-consumable-btn"
                    onClick={() => removeConsumable(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="add-consumable">
            <input
              type="text"
              value={newConsumable}
              onChange={(e) => setNewConsumable(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addConsumable())}
              placeholder="e.g., Sandpaper, Extension cord..."
              maxLength={50}
            />
            <button type="button" onClick={addConsumable} className="add-consumable-btn">
              + Add
            </button>
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
