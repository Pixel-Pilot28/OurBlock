import { useState } from 'react';
import './ItemRentalModal.css';

interface Props {
  itemTitle: string;
  itemImage?: string;
  itemNotes?: string;
  consumables?: Array<{ name: string; included: boolean }>;
  onClose: () => void;
  onSubmitRequest: (startDate: string, endDate: string, message: string, needsHelp: boolean) => void;
}

export function BorrowerRentalView({
  itemTitle,
  itemImage,
  itemNotes,
  consumables = [],
  onClose,
  onSubmitRequest,
}: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [needsHelp, setNeedsHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      await onSubmitRequest(startDate, endDate, message, needsHelp);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get tomorrow as minimum start date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // End date must be after start date
  const minEndDate = startDate || minDate;

  return (
    <div className="rental-modal-overlay" onClick={onClose}>
      <div className="rental-modal" onClick={(e) => e.stopPropagation()}>
        <header className="rental-header">
          <div className="rental-item-info">
            {itemImage && (
              <img src={itemImage} alt={itemTitle} className="rental-item-image" />
            )}
            <div>
              <h2>{itemTitle}</h2>
              <p className="rental-subtitle">Request to borrow this item</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="rental-content">
          <form onSubmit={handleSubmit}>
            {/* Date Selection */}
            <div className="dates-section">
              <h3>📅 Rental Period</h3>
              <div className="date-inputs">
                <div className="date-field">
                  <label htmlFor="start-date">Start Date *</label>
                  <input
                    type="date"
                    id="start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={minDate}
                    required
                  />
                </div>
                <div className="date-separator-large">→</div>
                <div className="date-field">
                  <label htmlFor="end-date">End Date *</label>
                  <input
                    type="date"
                    id="end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={minEndDate}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Owner's Notes */}
            {itemNotes && (
              <div className="owner-notes-display">
                <h3>📝 Owner's Notes</h3>
                <p>{itemNotes}</p>
              </div>
            )}

            {/* Consumables */}
            {consumables.length > 0 && (
              <div className="consumables-display">
                <h3>🔧 Included Consumables</h3>
                <div className="consumables-grid">
                  {consumables.map((item, index) => (
                    <div key={index} className="consumable-chip">
                      <span className={item.included ? 'included' : 'not-included'}>
                        {item.included ? '✓' : '✗'}
                      </span>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Help Toggle */}
            <div className="help-section">
              <div className="help-toggle-wrapper">
                <div className="help-info">
                  <h4>🤝 Need Help?</h4>
                  <p>Request assistance from the owner to learn how to use this item</p>
                </div>
                <button
                  type="button"
                  className={`help-toggle ${needsHelp ? 'active' : ''}`}
                  onClick={() => setNeedsHelp(!needsHelp)}
                >
                  {needsHelp ? 'Yes' : 'No'}
                </button>
              </div>
            </div>

            {/* Message */}
            <div className="message-section">
              <label htmlFor="borrow-message">Message (optional)</label>
              <textarea
                id="borrow-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Let the owner know why you need this item or any other details..."
                rows={4}
                maxLength={300}
              />
              <span className="char-count">{message.length}/300</span>
            </div>

            {/* Actions */}
            <div className="rental-actions">
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="submit-rental-btn"
                disabled={!startDate || !endDate || isSubmitting}
              >
                {isSubmitting ? 'Sending...' : '📤 Send Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
