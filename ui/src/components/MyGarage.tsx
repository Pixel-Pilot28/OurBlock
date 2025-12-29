import { useState, useEffect, useCallback } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { ItemCard } from './ItemCard';
import type { ItemOutput, TransactionOutput, BorrowRequestOutput, ItemStatus } from '../types';
import './MyGarage.css';

type Tab = 'my-items' | 'borrowed' | 'requests';

export function MyGarage() {
  const { client, isConnected } = useHolochain();
  const [activeTab, setActiveTab] = useState<Tab>('my-items');
  const [myItems, setMyItems] = useState<ItemOutput[]>([]);
  const [myTransactions, setMyTransactions] = useState<TransactionOutput[]>([]);
  const [myRequests, setMyRequests] = useState<BorrowRequestOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch my items
      const items = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'get_my_items',
        payload: null,
      });
      setMyItems(items);

      // Fetch my transactions
      const transactions = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'get_my_transactions',
        payload: null,
      });
      setMyTransactions(transactions);

      // Fetch my borrow requests
      const requests = await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'get_my_borrow_requests',
        payload: null,
      });
      setMyRequests(requests);

    } catch (err) {
      console.error('Failed to fetch garage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isConnected) {
      fetchData();
    }
  }, [isConnected, fetchData]);

  const handleStatusChange = async (item: ItemOutput, newStatus: ItemStatus) => {
    if (!client) return;

    try {
      await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'update_item_status',
        payload: [item.action_hash, newStatus],
      });

      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleReturnItem = async (transaction: TransactionOutput) => {
    if (!client) return;

    try {
      await client.callZome({
        role_name: 'our_block',
        zome_name: 'toolshed',
        fn_name: 'return_item',
        payload: transaction.action_hash,
      });

      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Failed to return item:', err);
    }
  };

  if (!isConnected) {
    return (
      <div className="my-garage">
        <div className="garage-loading">
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  const activeBorrows = myTransactions.filter(t => t.status === 'Active');

  return (
    <div className="my-garage">
      <header className="garage-header">
        <h2>🏠 My Garage</h2>
        <p className="garage-subtitle">Manage your items and borrows</p>
      </header>

      <div className="garage-tabs">
        <button 
          className={`garage-tab ${activeTab === 'my-items' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-items')}
        >
          📦 My Items ({myItems.length})
        </button>
        <button 
          className={`garage-tab ${activeTab === 'borrowed' ? 'active' : ''}`}
          onClick={() => setActiveTab('borrowed')}
        >
          🤝 Borrowed ({activeBorrows.length})
        </button>
        <button 
          className={`garage-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          📨 My Requests ({myRequests.length})
        </button>
      </div>

      {error && (
        <div className="garage-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchData}>Try Again</button>
        </div>
      )}

      {isLoading ? (
        <div className="garage-loading">
          <div className="loading-spinner"></div>
          <p>Loading your garage...</p>
        </div>
      ) : (
        <div className="garage-content">
          {activeTab === 'my-items' && (
            <div className="tab-content">
              {myItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <h3>No items listed</h3>
                  <p>Visit the Tool Shed to add items you'd like to share!</p>
                </div>
              ) : (
                <div className="items-grid">
                  {myItems.map((item, index) => (
                    <ItemCard 
                      key={`${arrayToHex(item.action_hash)}-${index}`}
                      item={item}
                      showOwnerActions={true}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'borrowed' && (
            <div className="tab-content">
              {activeBorrows.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🤝</div>
                  <h3>No active borrows</h3>
                  <p>You haven't borrowed any items yet.</p>
                </div>
              ) : (
                <div className="borrows-list">
                  {activeBorrows.map((txn, index) => (
                    <div key={`${arrayToHex(txn.action_hash)}-${index}`} className="borrow-card">
                      <div className="borrow-info">
                        <h4>Borrowed Item</h4>
                        <p className="borrow-meta">
                          <span>Due: {formatDueDate(txn.transaction.due_date)}</span>
                          <span>From: {shortenAgentKey(txn.transaction.lender)}</span>
                        </p>
                        {txn.transaction.notes && (
                          <p className="borrow-notes">{txn.transaction.notes}</p>
                        )}
                      </div>
                      <div className="borrow-actions">
                        <button 
                          className="return-btn"
                          onClick={() => handleReturnItem(txn)}
                        >
                          ✅ Mark as Returned
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="tab-content">
              {myRequests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📨</div>
                  <h3>No pending requests</h3>
                  <p>You haven't made any borrow requests yet.</p>
                </div>
              ) : (
                <div className="requests-list">
                  {myRequests.map((req, index) => (
                    <div key={`${arrayToHex(req.action_hash)}-${index}`} className="request-card">
                      <div className="request-info">
                        <h4>Borrow Request</h4>
                        <p className="request-meta">
                          <span>Requested: {formatTimestamp(req.request.created_at)}</span>
                          <span>To: {shortenAgentKey(req.request.owner)}</span>
                        </p>
                        {req.request.message && (
                          <p className="request-message">"{req.request.message}"</p>
                        )}
                      </div>
                      <div className="request-status">
                        <span className="status-pending">⏳ Pending</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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

function shortenAgentKey(key: Uint8Array): string {
  const hex = Array.from(key.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `Neighbor #${hex.toUpperCase()}`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp / 1000);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp / 1000);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff < 0) {
    return 'Overdue!';
  }
  
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Tomorrow';
  }
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
