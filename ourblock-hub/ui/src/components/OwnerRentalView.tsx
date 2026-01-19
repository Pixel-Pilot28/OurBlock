import { useState } from 'react';
import './ItemRentalModal.css';

interface RentalRequest {
  id: string;
  borrower: string;
  startDate: Date;
  endDate: Date;
  message: string;
  needsHelp: boolean;
}

interface Consumable {
  name: string;
  included: boolean;
}

interface Props {
  itemTitle: string;
  itemImage?: string;
  itemNotes?: string;
  isAvailable: boolean;
  onAvailabilityToggle: (available: boolean) => void;
  rentalRequests: RentalRequest[];
  consumables: Consumable[];
  onConsumablesUpdate: (consumables: Consumable[]) => void;
  onApproveRequest: (requestId: string) => void;
  onClose: () => void;
}

export function OwnerRentalView({
  itemTitle,
  itemImage,
  isAvailable,
  onAvailabilityToggle,
  rentalRequests,
  consumables,
  onConsumablesUpdate,
  onApproveRequest,
  onClose,
}: Props) {
  const [newConsumable, setNewConsumable] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const addConsumable = () => {
    if (!newConsumable.trim()) return;
    onConsumablesUpdate([...consumables, { name: newConsumable.trim(), included: true }]);
    setNewConsumable('');
  };

  const toggleConsumable = (index: number) => {
    const updated = [...consumables];
    updated[index].included = !updated[index].included;
    onConsumablesUpdate(updated);
  };

  const removeConsumable = (index: number) => {
    onConsumablesUpdate(consumables.filter((_, i) => i !== index));
  };

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
              <p className="rental-subtitle">Manage your item</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="rental-content">
          {/* Availability Toggle */}
          <div className="availability-section">
            <div className="section-header">
              <h3>📦 Availability Status</h3>
              <button
                className={`availability-toggle ${isAvailable ? 'available' : 'unavailable'}`}
                onClick={() => onAvailabilityToggle(!isAvailable)}
              >
                {isAvailable ? '✅ Available' : '🔒 Unavailable'}
              </button>
            </div>
          </div>

          {/* Rental Requests */}
          <div className="requests-section">
            <h3>📅 Rental Requests ({rentalRequests.length})</h3>
            {rentalRequests.length === 0 ? (
              <div className="empty-requests">
                <p>No pending requests</p>
              </div>
            ) : (
              <div className="requests-list">
                {rentalRequests.map((request) => (
                  <div key={request.id} className="request-card">
                    <div className="request-header">
                      <span className="borrower-name">👤 {request.borrower}</span>
                      {request.needsHelp && <span className="needs-help-badge">🤝 Needs Help</span>}
                    </div>
                    <div className="request-dates">
                      <span>{request.startDate.toLocaleDateString()}</span>
                      <span className="date-separator">→</span>
                      <span>{request.endDate.toLocaleDateString()}</span>
                    </div>
                    {request.message && (
                      <p className="request-message">"{request.message}"</p>
                    )}
                    <button
                      className="approve-btn"
                      onClick={() => onApproveRequest(request.id)}
                    >
                      ✓ Approve Request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consumables */}
          <div className="consumables-section">
            <h3>🔧 Consumables & Accessories</h3>
            <p className="section-hint">Items needed for this tool and whether they're included</p>
            
            <div className="consumables-list">
              {consumables.map((consumable, index) => (
                <div key={index} className="consumable-item">
                  <span className="consumable-name">{consumable.name}</span>
                  <div className="consumable-status">
                    <button
                      className={`status-toggle ${consumable.included ? 'included' : 'not-included'}`}
                      onClick={() => toggleConsumable(index)}
                    >
                      {consumable.included ? '✓ Included' : '✗ Not Included'}
                    </button>
                  </div>
                  <button
                    className="remove-consumable-btn"
                    onClick={() => removeConsumable(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="add-consumable">
              <input
                type="text"
                value={newConsumable}
                onChange={(e) => setNewConsumable(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addConsumable()}
                placeholder="e.g., Sandpaper, Extension cord..."
                maxLength={50}
              />
              <button onClick={addConsumable} className="add-btn">
                + Add
              </button>
            </div>
          </div>

          {/* Owner Notes */}
          <div className="notes-section">
            <div className="section-header">
              <h3>📝 Notes for Borrowers</h3>
              <button
                className="edit-notes-btn"
                onClick={() => setEditingNotes(!editingNotes)}
              >
                {editingNotes ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add instructions, warnings, or tips for borrowers..."
                rows={4}
                maxLength={500}
              />
            ) : (
              <p className="notes-display">
                {notes || 'No notes added yet. Click Edit to add instructions for borrowers.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
