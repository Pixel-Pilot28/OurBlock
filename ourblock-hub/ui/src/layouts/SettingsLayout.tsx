import { Outlet, NavLink } from 'react-router-dom';
import './SettingsLayout.css';

export function SettingsLayout() {
  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <h2 className="settings-title">Settings</h2>
        <nav className="settings-nav">
          <NavLink 
            to="/settings/profile" 
            className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">👤</span>
            <div className="nav-text">
              <span className="nav-label">Account & Profile</span>
              <span className="nav-description">Personal info and preferences</span>
            </div>
          </NavLink>
          
          <NavLink 
            to="/settings/system" 
            className={({ isActive }) => `settings-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">⚙️</span>
            <div className="nav-text">
              <span className="nav-label">Data & System</span>
              <span className="nav-description">Backup, updates, and maintenance</span>
            </div>
          </NavLink>
        </nav>
      </aside>
      
      <main className="settings-content">
        <Outlet />
      </main>
    </div>
  );
}
