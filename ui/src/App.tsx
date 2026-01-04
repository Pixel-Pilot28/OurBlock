import { useState, useEffect } from 'react';
import { HolochainProvider } from './contexts/HolochainContext';
import { ProfileForm } from './components/ProfileForm';
import { ProfileDisplay } from './components/ProfileDisplay';
import { PostFeed } from './components/PostFeed';
import { ItemGallery } from './components/ItemGallery';
import { MyGarage } from './components/MyGarage';
import { ChatWindow } from './components/ChatWindow';
import { EventsFeed } from './components/EventsFeed';
import { SharedSpaces } from './components/SharedSpaces';
import { CommunitySwitcher, MOCK_COMMUNITIES, type Community } from './components/CommunitySwitcher';
import { useHolochain } from './contexts/HolochainContext';
import './App.css';

type View = 'profile' | 'feed' | 'toolshed' | 'garage' | 'events' | 'spaces' | 'chat';

function AppContent() {
  const { client, isConnected, error } = useHolochain();
  const [hasProfile, setHasProfile] = useState(false);
  const [_isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [currentView, setCurrentView] = useState<View>('feed');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [currentCommunity, setCurrentCommunity] = useState<Community>(MOCK_COMMUNITIES[0]);

  // Check if user already has a profile
  useEffect(() => {
    async function checkProfile() {
      if (!client || !isConnected) return;

      try {
        const profile = await client.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_my_profile',
          payload: null,
        });
        setHasProfile(profile !== null);
      } catch (err) {
        console.error('Failed to check profile:', err);
        setHasProfile(false);
      } finally {
        setIsCheckingProfile(false);
      }
    }

    checkProfile();
  }, [client, isConnected]);

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
        </div>
        <p className="tagline">Your {currentCommunity.name} Community</p>
        <nav className="app-nav">
          <button 
            className={`nav-btn ${currentView === 'feed' ? 'active' : ''}`}
            onClick={() => setCurrentView('feed')}
          >
            📰 Feed
          </button>
          <button 
            className={`nav-btn ${currentView === 'toolshed' ? 'active' : ''}`}
            onClick={() => setCurrentView('toolshed')}
          >
            🔧 Tool Shed
          </button>
          <button 
            className={`nav-btn ${currentView === 'garage' ? 'active' : ''}`}
            onClick={() => setCurrentView('garage')}
          >
            🏠 My Garage
          </button>
          <button 
            className={`nav-btn ${currentView === 'events' ? 'active' : ''}`}
            onClick={() => setCurrentView('events')}
          >
            📅 Events
          </button>
          <button 
            className={`nav-btn ${currentView === 'spaces' ? 'active' : ''}`}
            onClick={() => setCurrentView('spaces')}
          >
            🏛️ Spaces
          </button>
          <button 
            className={`nav-btn ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentView('chat')}
          >
            💬 Chat
          </button>
          <button 
            className={`nav-btn ${currentView === 'profile' ? 'active' : ''}`}
            onClick={() => setCurrentView('profile')}
          >
            👤 Profile
          </button>
        </nav>
      </header>
      <main className="app-main">
        {currentView === 'feed' ? (
          <PostFeed />
        ) : currentView === 'toolshed' ? (
          <ItemGallery />
        ) : currentView === 'garage' ? (
          <MyGarage />
        ) : currentView === 'events' ? (
          <EventsFeed />
        ) : currentView === 'spaces' ? (
          <SharedSpaces />
        ) : currentView === 'chat' ? (
          <ChatWindow />
        ) : !hasProfile ? (
          <ProfileForm onProfileCreated={() => setHasProfile(true)} />
        ) : (
          <ProfileDisplay />
        )}
      </main>
      <footer className="app-footer">
        <p>Powered by Holochain</p>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <HolochainProvider>
      <AppContent />
    </HolochainProvider>
  );
}
