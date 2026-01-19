import { useNavigate } from 'react-router-dom';

/**
 * Landing page for new users and guests
 */
export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏘️</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            OurBlock
          </h1>
          <p className="text-xl text-gray-600">
            Your neighborhood, your network
          </p>
        </div>

        {/* Description */}
        <div className="mb-8 space-y-4 text-gray-700">
          <p className="text-lg">
            Welcome to <strong>OurBlock</strong> — a peer-to-peer neighborhood network
            built on Holochain technology.
          </p>
          <p>
            Connect with your neighbors, share tools, organize events, and build
            community without relying on centralized platforms.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-semibold text-gray-900">Your Data, Your Control</h3>
              <p className="text-sm text-gray-600">
                Peer-to-peer architecture means no central server storing your data
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🤝</span>
            <div>
              <h3 className="font-semibold text-gray-900">Trust-Based Network</h3>
              <p className="text-sm text-gray-600">
                Join by invitation only, ensuring authentic neighborhood connections
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">🌐</span>
            <div>
              <h3 className="font-semibold text-gray-900">Local-First Design</h3>
              <p className="text-sm text-gray-600">
                Works on your local network with offline-first capabilities
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <span className="text-2xl">✨</span>
            <div>
              <h3 className="font-semibold text-gray-900">Zero Configuration</h3>
              <p className="text-sm text-gray-600">
                Just enter an invite code and you're ready to connect
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to join your neighborhood?
          </h2>
          <p className="text-gray-700 mb-4">
            If you received an invite code from a neighbor, click below to get started.
          </p>
          <button
            onClick={() => navigate('/join')}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-[1.02] shadow-lg"
          >
            Join with Invite Code →
          </button>
        </div>

        {/* Additional Info */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            Don't have an invite code? Ask a neighbor who's already on OurBlock
            to send you one.
          </p>
          <p className="text-xs">
            Powered by{' '}
            <a
              href="https://holochain.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Holochain
            </a>{' '}
            — distributed computing for the people
          </p>
        </div>
      </div>
    </div>
  );
}
