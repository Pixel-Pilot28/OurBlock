import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { QRCodeSVG } from 'qrcode.react';
import { neighborhoodNameSchema, validityDaysSchema, validateField } from '../utils/validation';
import { logger } from '../utils/logger';

interface Invitation {
  neighbor_name: string;
  invite_code: string;
  created_at: number;
  expires_at: number;
  voucher: Uint8Array | null;
  revoked: boolean;
}

interface InvitationWithHash {
  invitation: Invitation;
  hash: Uint8Array;
}

interface GenerateInvitationInput {
  neighbor_name: string;
  validity_duration?: number;
  voucher?: Uint8Array;
}

interface InvitationOutput {
  invite_code: string;
  invitation_hash: Uint8Array;
  created_at: number;
  expires_at: number;
}

/**
 * Admin page for managing neighborhood invitations
 * Hub admins can generate, view, and revoke invite codes
 */
export function AdminPage() {
  const { client } = useHolochain();
  
  const [neighborName, setNeighborName] = useState('');
  const [validityDays, setValidityDays] = useState(7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [invitations, setInvitations] = useState<InvitationWithHash[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('active');
  const [searchTerm, setSearchTerm] = useState('');

  // Load invitations on mount
  useEffect(() => {
    loadInvitations();
  }, [client]);

  const loadInvitations = async () => {
    if (!client) return;
    
    try {
      setIsLoadingInvitations(true);
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'list_invitations',
        payload: null,
      });
      
      // Result is Vec<(Invitation, ActionHash)>
      const invitationsData = result as Array<[Invitation, Uint8Array]>;
      const formatted: InvitationWithHash[] = invitationsData.map(([inv, hash]) => ({
        invitation: inv,
        hash: hash,
      }));
      
      setInvitations(formatted);
    } catch (err) {
      logger.error('Failed to load invitations', err);
      setError('Failed to load invitations');
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGeneratedCode(null);

    // Validate neighbor name
    const nameValidation = validateField(neighborhoodNameSchema, neighborName);
    if (!nameValidation.success) {
      setError(nameValidation.error);
      return;
    }

    // Validate validity days
    const daysValidation = validateField(validityDaysSchema, validityDays);
    if (!daysValidation.success) {
      setError(daysValidation.error);
      return;
    }

    if (!client) {
      setError('Not connected to Holochain');
      return;
    }

    setIsGenerating(true);

    try {
      const input: GenerateInvitationInput = {
        neighbor_name: nameValidation.data,
        validity_duration: daysValidation.data * 24 * 60 * 60, // Convert days to seconds
      };

      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'generate_invitation',
        payload: input,
      });

      const output = result as InvitationOutput;
      setGeneratedCode(output.invite_code);
      
      // Reload invitations list
      await loadInvitations();
      
      // Reset form
      setNeighborName('');
    } catch (err: any) {
      logger.error('Failed to generate invitation', err);
      setError(err.message || 'Failed to generate invitation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeInvitation = async (hash: Uint8Array) => {
    if (!client) return;
    
    if (!confirm('Are you sure you want to revoke this invitation? This cannot be undone.')) {
      return;
    }

    try {
      await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'revoke_invitation',
        payload: hash,
      });

      // Reload invitations
      await loadInvitations();
    } catch (err) {
      logger.error('Failed to revoke invitation', err);
      alert('Failed to revoke invitation');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Invite code copied to clipboard!');
  };

  const formatTimestamp = (micros: number): string => {
    const date = new Date(micros / 1000);
    return date.toLocaleString();
  };

  const isExpired = (expiresAt: number): boolean => {
    return Date.now() * 1000 > expiresAt;
  };

  const filteredInvitations = invitations.filter(({ invitation }) => {
    // Filter by status
    if (filter === 'active' && (invitation.revoked || isExpired(invitation.expires_at))) {
      return false;
    }
    if (filter === 'expired' && !isExpired(invitation.expires_at)) {
      return false;
    }
    if (filter === 'revoked' && !invitation.revoked) {
      return false;
    }

    // Filter by search term
    if (searchTerm && !invitation.neighbor_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔑 Invitation Management
          </h1>
          <p className="text-gray-600">
            Generate and manage invite codes for your neighborhood
          </p>
        </div>

        {/* Generate Invitation Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Generate New Invitation
          </h2>

          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div>
              <label htmlFor="neighborName" className="block text-sm font-medium text-gray-700 mb-1">
                Neighbor Name
              </label>
              <input
                type="text"
                id="neighborName"
                value={neighborName}
                onChange={(e) => setNeighborName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Alice Smith"
                disabled={isGenerating}
              />
            </div>

            <div>
              <label htmlFor="validityDays" className="block text-sm font-medium text-gray-700 mb-1">
                Validity Period (days)
              </label>
              <input
                type="number"
                id="validityDays"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value))}
                min="1"
                max="30"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-1">
                How long this invite code will be valid (default: 7 days)
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating || !neighborName.trim()}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate Invite Code'}
            </button>
          </form>

          {/* Generated Code Display */}
          {generatedCode && (
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ✅ Invitation Generated!
              </h3>

              {/* QR Code */}
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <QRCodeSVG value={generatedCode} size={200} />
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invite Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedCode}
                        readOnly
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(generatedCode)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      <strong>Share this code with {neighborName}</strong>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      They can scan the QR code or enter the code manually at your Hub's join page
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invitations List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              All Invitations ({filteredInvitations.length})
            </h2>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('expired')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'expired'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Expired
              </button>
              <button
                onClick={() => setFilter('revoked')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'revoked'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Revoked
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by neighbor name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Table */}
          {isLoadingInvitations ? (
            <div className="text-center py-8 text-gray-500">
              Loading invitations...
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No invitations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Neighbor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Expires</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvitations.map(({ invitation, hash }) => {
                    const expired = isExpired(invitation.expires_at);
                    const active = !invitation.revoked && !expired;

                    return (
                      <tr key={hash.toString()} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{invitation.neighbor_name}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatTimestamp(invitation.created_at)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatTimestamp(invitation.expires_at)}
                        </td>
                        <td className="py-3 px-4">
                          {invitation.revoked ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Revoked
                            </span>
                          ) : expired ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyToClipboard(invitation.invite_code)}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Copy
                            </button>
                            {active && (
                              <button
                                onClick={() => handleRevokeInvitation(hash)}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
