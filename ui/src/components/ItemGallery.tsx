import { useState, useEffect, useCallback } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { ItemCard } from './ItemCard';
import { AddItemForm } from './AddItemForm';
import { BorrowRequestModal } from './BorrowRequestModal';
import type { ItemOutput } from '../types';
import { normalizeItemOutput, normalizeItems } from '../utils/itemStatus';
import './ItemGallery.css';

export function ItemGallery() {
  const { client, isConnected } = useHolochain();
  const [items, setItems] = useState<ItemOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const [borrowingItem, setBorrowingItem] = useState<ItemOutput | null>(null);

  const fetchItems = useCallback(async () => {
    if (!client) return;

    try {
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'get_all_items',
        payload: null,
      });

      setItems(normalizeItems(result));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isConnected) {
      fetchItems();
    }
  }, [isConnected, fetchItems]);

  const handleItemAdded = (newItem?: ItemOutput) => {
    if (newItem) {
      setItems((prev) => [normalizeItemOutput(newItem), ...prev]);
    } else {
      fetchItems();
    }
    setShowAddForm(false);
  };

  const handleBorrowRequest = (item: ItemOutput) => {
    setBorrowingItem(item);
  };

  const handleBorrowSuccess = () => {
    setBorrowingItem(null);
    // Optionally show a success message or refresh data
  };

  const filteredItems = filter === 'available' 
    ? items.filter(item => item.item.status === 'Available')
    : items;

  if (!isConnected) {
    return (
      <div className="item-gallery">
        <div className="gallery-loading">
          <p>Connecting to the Tool Shed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="item-gallery">
      <header className="gallery-header">
        <div className="gallery-title">
          <h2>🔧 Tool Shed</h2>
          <p className="gallery-subtitle">Borrow tools and items from your neighbors</p>
        </div>
        <div className="gallery-actions">
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Items ({items.length})
            </button>
            <button 
              className={`filter-tab ${filter === 'available' ? 'active' : ''}`}
              onClick={() => setFilter('available')}
            >
              Available ({items.filter(i => i.item.status === 'Available').length})
            </button>
          </div>
          <button 
            className="add-item-btn"
            onClick={() => setShowAddForm(true)}
          >
            ➕ Add Item
          </button>
        </div>
      </header>

      {showAddForm && (
        <AddItemForm 
          onItemAdded={handleItemAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {error && (
        <div className="gallery-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchItems}>Try Again</button>
        </div>
      )}

      {isLoading ? (
        <div className="gallery-loading">
          <div className="loading-spinner"></div>
          <p>Loading items from the Tool Shed...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="gallery-empty">
          <div className="empty-icon">🧰</div>
          <h3>The Tool Shed is empty!</h3>
          <p>Be the first to list a lawn mower or a ladder to help your neighbors. Every shared tool strengthens our community!</p>
          <button 
            className="add-first-item-btn"
            onClick={() => setShowAddForm(true)}
          >
            ➕ Share Your First Item
          </button>
        </div>
      ) : (
        <div className="items-grid">
          {filteredItems.map((item, index) => (
            <ItemCard 
              key={`${arrayToHex(item.action_hash)}-${index}`}
              item={item}
              onClick={() => handleBorrowRequest(item)}
            />
          ))}
        </div>
      )}

      {borrowingItem && (
        <BorrowRequestModal
          item={borrowingItem}
          onClose={() => setBorrowingItem(null)}
          onSuccess={handleBorrowSuccess}
        />
      )}
    </div>
  );
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
