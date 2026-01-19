import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { HolochainProvider } from './contexts/HolochainContext';
import { queryClient, persistOptions } from './utils/queryClient';
import { PostFeed } from './components/PostFeed';
import { ItemsPage } from './components/ItemsPage';
import { ChatWindow } from './components/ChatWindow';
import { EventsFeed } from './components/EventsFeed';
import { SharedSpaces } from './components/SharedSpaces';
import { CommunitySwitcher, MOCK_COMMUNITIES, type Community } from './components/CommunitySwitcher';
import { SettingsLayout } from './layouts/SettingsLayout';
import { ProfilePage } from './pages/ProfilePage';
import { SystemPage } from './pages/SystemPage';
import JoinNeighborhood from './pages/JoinNeighborhood';
import { AdminPage } from './pages/AdminPage';
import ConnectionStatus from './components/ConnectionStatus';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import { FirstJoinerWelcome } from './components/FirstJoinerWelcome';
import { useHolochain } from './contexts/HolochainContext';
import './App.css';

type View = 'feed' | 'items' | 'events' | 'spaces' | 'chat';

function AppContent() {
  const { isConnected, error } = useHolochain();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState<View>('feed');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [currentCommunity, setCurrentCommunity] = useState<Community>(MOCK_COMMUNITIES[0]);
  const [hubAgentPubKey, setHubAgentPubKey] = useState<Uint8Array | undefined>();
  const [showFirstJoiner, setShowFirstJoiner] = useState(true);

  // Receive hubAgentPubKey from navigation state (from JoinNeighborhood)
  useEffect(() => {
    if (location.state?.hubAgentPubKey) {
      setHubAgentPubKey(location.state.hubAgentPubKey);
    }
  }, [location]);

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    navigate('/');
  };

  if (error) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🏘️ OurBlock</h1>
        </header>
        <main className="app-main">
          <div className="error-message">
            <h2>Connection Error</h2>
            <p>{error}</p>
            <p>Make sure Holochain is running and try again.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🏘️ OurBlock</h1>
        </header>
        <main className="app-main">
          <div className="loading">
            <p>Connecting to Holochain...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <SyncStatusIndicator />
      
      {hubAgentPubKey && showFirstJoiner && (
        <FirstJoinerWelcome 
          hubAgentPubKey={hubAgentPubKey}
          onDismiss={() => setShowFirstJoiner(false)}
        />
      )}
      
      <CommunitySwitcher 
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
        currentCommunity={currentCommunity}
        onCommunityChange={setCurrentCommunity}
      />
      
      <header className="app-header">
        <div className="header-top">
          <button 
            className="community-toggle-btn"
            onClick={() => setIsSwitcherOpen(true)}
            aria-label="Switch community"
          >
            <span className="community-emoji">{currentCommunity.emoji}</span>
            <div className="community-name-wrapper">
              <span className="community-name">{currentCommunity.name}</span>
              <span className="community-subtitle">{currentCommunity.memberCount} members</span>
            </div>
            <span className="chevron">›</span>
          </button>
          <h1>🏘️ OurBlock</h1>
          <ConnectionStatus className="ml-auto" />
        </div>
        <p className="tagline">Your {currentCommunity.name} Community</p>
        <nav className="app-nav">
          <button 
            className={`nav-btn ${currentView === 'feed' ? 'active' : ''}`}
            onClick={() => handleViewChange('feed')}
          >
            📰 Feed
          </button>
          <button 
            className={`nav-btn ${currentView === 'items' ? 'active' : ''}`}
            onClick={() => handleViewChange('items')}
          >
            🔧 Tool Shed
          </button>
          <button 
            className={`nav-btn ${currentView === 'events' ? 'active' : ''}`}
            onClick={() => handleViewChange('events')}
          >
            📅 Events
          </button>
          <button 
            className={`nav-btn ${currentView === 'spaces' ? 'active' : ''}`}
            onClick={() => handleViewChange('spaces')}
          >
            🏛️ Spaces
          </button>
          <button 
            className={`nav-btn ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => handleViewChange('chat')}
          >
            💬 Chat
          </button>
          <button 
            className="nav-btn"
            onClick={() => navigate('/settings/profile')}
          >
            ⚙️ Settings
          </button>
          <button 
            className="nav-btn"
            onClick={() => navigate('/admin')}
          >
            🔑 Admin
          </button>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={
            <>
              {currentView === 'feed' && <PostFeed />}
              {currentView === 'items' && <ItemsPage />}
              {currentView === 'events' && <EventsFeed />}
              {currentView === 'spaces' && <SharedSpaces />}
              {currentView === 'chat' && <ChatWindow />}
            </>
          } />
          <Route path="/join" element={<JoinNeighborhood />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/profile" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="system" element={<SystemPage />} />
          </Route>
        </Routes>
      </main>
      <footer className="app-footer">
        <p>Powered by Holochain</p>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <HolochainProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </HolochainProvider>
    </PersistQueryClientProvider>
  );
}
