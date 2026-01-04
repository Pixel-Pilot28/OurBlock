import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import type { ItemOutput, ItemStatus } from '../types';
import { normalizeItemStatus } from '../utils/itemStatus';
import './ItemEditor.css';

interface DateRange {
  start: Date;
  end: Date;
}

interface Props {
  item: ItemOutput;
  onClose: () => void;
  onSave: (updatedItem: ItemOutput) => void;
}

export function ItemEditor({ item, onClose, onSave }: Props) {
  const { client } = useHolochain();
  const [title, setTitle] = useState(item.item.title);
  const [description, setDescription] = useState(item.item.description);
  const normalizedStatus = normalizeItemStatus(item.item.status);
  const [isAvailableNow, setIsAvailableNow] = useState(normalizedStatus === 'Available');
  const [unavailableDates, setUnavailableDates] = useState<DateRange[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check for changes
    const titleChanged = title !== item.item.title;
    const descChanged = description !== item.item.description;
    const currentStatus = normalizeItemStatus(item.item.status);
    const statusChanged = (isAvailableNow && currentStatus !== 'Available') || 
               (!isAvailableNow && currentStatus === 'Available');
    setHasChanges(titleChanged || descChanged || statusChanged);
  }, [title, description, isAvailableNow, item]);

  const handleSave = async () => {
    if (!client) return;

    setIsSaving(true);
    setError(null);

    try {
      // Update item details if changed
      if (title !== item.item.title || description !== item.item.description) {
        await client.callZome({
          role_name: 'our_block',
          zome_name: 'toolshed',
          fn_name: 'update_item',
          payload: {
            action_hash: item.action_hash,
            title: title.trim(),
            description: description.trim(),
          },
        });
      }

      // Update status if changed
      const currentlyAvailable = normalizeItemStatus(item.item.status) === 'Available';
      if (isAvailableNow !== currentlyAvailable) {
        const newStatus = { type: isAvailableNow ? 'Available' : 'Unavailable' };
        await client.callZome({
          role_name: 'our_block',
          zome_name: 'toolshed',
          fn_name: 'update_item_status',
          payload: {
            action_hash: item.action_hash,
            status: newStatus,
          },
        });
      }

      // Create updated item for callback
      const updatedItem: ItemOutput = {
        ...item,
        item: {
          ...item.item,
          title: title.trim(),
          description: description.trim(),
          status: isAvailableNow ? 'Available' : 'Unavailable',
        },
      };

      onSave(updatedItem);
    } catch (err) {
      console.error('Failed to update item:', err);
      setError(err instanceof Error ? err.message : 'Failed to update item');
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
    <div className="item-editor-overlay" onClick={handleBackdropClick}>
      <div className="item-editor">
        <header className="editor-header">
          <h2>✏️ Edit Item</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="editor-content">
          <div className="form-section">
            <h3>📦 Item Details</h3>
            
            <div className="form-group">
              <label htmlFor="edit-title">Title</label>
              <input
                id="edit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="What is this item?"
              />
              <span className="char-count">{title.length}/100</span>
            </div>

            <div className="form-group">
              <label htmlFor="edit-description">Description</label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Describe the item, condition, any special instructions..."
              />
              <span className="char-count">{description.length}/1000</span>
            </div>
          </div>

          <div className="form-section">
            <h3>📅 Availability</h3>
            <AvailabilityCalendar
              unavailableDates={unavailableDates}
              onUnavailableDatesChange={setUnavailableDates}
              isAvailableNow={isAvailableNow}
              onAvailableNowChange={setIsAvailableNow}
            />
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
            disabled={isSaving || !hasChanges || !title.trim()}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </footer>
      </div>
    </div>
  );
}
