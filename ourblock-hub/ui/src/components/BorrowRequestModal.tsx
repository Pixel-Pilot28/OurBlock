import { useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import type { ItemOutput } from '../types';
import './BorrowRequestModal.css';

interface Props {
  item: ItemOutput;
  onClose: () => void;
  onSuccess: () => void;
}

export function BorrowRequestModal({ item, onClose, onSuccess }: Props) {
  const { client } = useHolochain();
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!client || !dueDate) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Convert date to timestamp (microseconds)
      const dueDateTimestamp = new Date(dueDate).getTime() * 1000;

      await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'request_borrow',
        payload: {
          item_hash: item.action_hash,
          requested_due_date: dueDateTimestamp,
          message: message.trim() || null,
        },
      });

      onSuccess();
    } catch (err) {
      console.error('Failed to request borrow:', err);
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Get tomorrow as minimum date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="borrow-modal-overlay" onClick={handleBackdropClick}>
      <div className="borrow-modal">
        <header className="modal-header">
          <h2>🤝 Request to Borrow</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="modal-content">
          <div className="item-preview">
            <h3>{item.item.title}</h3>
            <p>{item.item.description}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="due-date">When do you need to return it? *</label>
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={minDate}
                required
              />
              <span className="field-hint">Choose a reasonable return date</span>
            </div>

            <div className="form-group">
              <label htmlFor="message">Message (optional)</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Let the owner know why you need this item or any other details..."
                rows={4}
                maxLength={500}
              />
              <span className="char-count">{message.length}/500</span>
            </div>

            {error && (
              <div className="modal-error">
                ⚠️ {error}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={!dueDate || isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
