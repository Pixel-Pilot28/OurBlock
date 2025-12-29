import { useState, useEffect, useCallback } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { ItemCard } from './ItemCard';
import { AddItemForm } from './AddItemForm';
import type { ItemOutput } from '../types';
import './ItemGallery.css';

interface Props {
  onBorrowRequest?: (item: ItemOutput) => void;
}

export function ItemGallery({ onBorrowRequest }: Props) {
  const { client, isConnected } = useHolochain();
  const [items, setItems] = useState<ItemOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available'>('all');

  const fetchItems = useCallback(async () => {
    if (!client) return;

    try {
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'get_all_items',
        payload: null,
      });

      setItems(result);
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

  const handleItemAdded = (newItem: ItemOutput) => {
    setItems((prev) => [newItem, ...prev]);
    setShowAddForm(false);
  };

  const handleBorrowRequest = (item: ItemOutput) => {
    if (onBorrowRequest) {
      onBorrowRequest(item);
    }
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
          <h3>No items yet</h3>
          <p>Be the first to share something with your neighbors!</p>
          <button 
            className="add-first-item-btn"
            onClick={() => setShowAddForm(true)}
          >
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="items-grid">
          {filteredItems.map((item, index) => (
            <ItemCard 
              key={`${arrayToHex(item.action_hash)}-${index}`}
              item={item}
              onBorrowRequest={handleBorrowRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
