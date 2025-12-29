import { useState, useEffect } from 'react';
import { HolochainProvider } from './contexts/HolochainContext';
import { ProfileForm } from './components/ProfileForm';
import { ProfileDisplay } from './components/ProfileDisplay';
import { PostFeed } from './components/PostFeed';
import { useHolochain } from './contexts/HolochainContext';
import './App.css';

type View = 'profile' | 'feed';

function AppContent() {
  const { client, isConnected, error } = useHolochain();
  const [hasProfile, setHasProfile] = useState(false);
  const [currentView, setCurrentView] = useState<View>('feed');

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
      <header className="app-header">
        <h1>🏘️ OurBlock</h1>
        <p className="tagline">Your Neighborhood Community</p>
        <nav className="app-nav">
          <button 
            className={`nav-btn ${currentView === 'feed' ? 'active' : ''}`}
            onClick={() => setCurrentView('feed')}
          >
            📰 Feed
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
