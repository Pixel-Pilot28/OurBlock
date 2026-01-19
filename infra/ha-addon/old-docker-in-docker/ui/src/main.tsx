import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './utils/sentry';
import './index.css';

// Initialize Sentry error tracking (production only)
initSentry();

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceWorker.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
