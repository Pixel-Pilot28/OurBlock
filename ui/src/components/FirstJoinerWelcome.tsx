import { useEffect, useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { isFirstJoiner } from '../utils/onboarding';
import { logger } from '../utils/logger';
import './FirstJoinerWelcome.css';

interface FirstJoinerWelcomeProps {
  hubAgentPubKey?: Uint8Array;
  onDismiss?: () => void;
}

/**
 * FirstJoinerWelcome Component
 * 
 * Displays a friendly welcome message for the first neighbor to join
 * a new neighborhood. Encourages them to post a tool and break the ice.
 */
export function FirstJoinerWelcome({ hubAgentPubKey, onDismiss }: FirstJoinerWelcomeProps) {
  const { client } = useHolochain();
  const [isFirst, setIsFirst] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkFirstJoiner() {
      if (!client || !hubAgentPubKey) {
        setIsChecking(false);
        return;
      }

      // Check if already dismissed in this session
      const dismissedKey = 'firstJoinerWelcomeDismissed';
      if (sessionStorage.getItem(dismissedKey)) {
        setDismissed(true);
        setIsChecking(false);
        return;
      }

      try {
        const result = await isFirstJoiner(client, hubAgentPubKey);
        logger.info('First joiner check completed', { isFirst: result });
        setIsFirst(result);
      } catch (err) {
        logger.error('Error checking first joiner status', err);
      } finally {
        setIsChecking(false);
      }
    }

    checkFirstJoiner();
  }, [client, hubAgentPubKey]);

  const handleDismiss = () => {
    sessionStorage.setItem('firstJoinerWelcomeDismissed', 'true');
    setDismissed(true);
    onDismiss?.();
  };

  // Don't show if still checking, not first, or already dismissed
  if (isChecking || !isFirst || dismissed) {
    return null;
  }

  return (
    <div className="first-joiner-welcome">
      <div className="first-joiner-welcome__content">
        <div className="first-joiner-welcome__icon">🎉</div>
        <h2 className="first-joiner-welcome__title">Welcome, Pioneer!</h2>
        <p className="first-joiner-welcome__message">
          You are the <strong>first neighbor</strong> to join this community! 
          Break the ice by sharing a tool, posting an update, or introducing yourself.
        </p>
        <div className="first-joiner-welcome__tips">
          <h3>Get Started:</h3>
          <ul>
            <li>📝 Post your first update to the feed</li>
            <li>🔧 Share a tool in the ToolShed</li>
            <li>👋 Introduce yourself in your profile</li>
            <li>🎪 Create your first neighborhood event</li>
          </ul>
        </div>
        <div className="first-joiner-welcome__actions">
          <button 
            className="first-joiner-welcome__dismiss"
            onClick={handleDismiss}
          >
            Got it, let's go!
          </button>
        </div>
      </div>
    </div>
  );
}
