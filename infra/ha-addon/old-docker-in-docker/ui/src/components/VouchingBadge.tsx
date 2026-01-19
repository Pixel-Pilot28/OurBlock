import { useEffect, useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { getVoucherInfo } from '../utils/onboarding';
import { logger } from '../utils/logger';
import './VouchingBadge.css';

interface VoucherInfo {
  nickname: string;
  agent: Uint8Array;
}

interface VouchingBadgeProps {
  /** Override voucher info (for displaying other users' vouchers) */
  voucherInfo?: VoucherInfo | null;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
}

/**
 * VouchingBadge Component
 * 
 * Displays a shield icon with "Vouched by [Admin Name]" to show
 * that this user was invited/vouched for by a trusted neighbor.
 * 
 * Builds trust by showing the chain of vouching.
 */
export function VouchingBadge({ voucherInfo: providedVoucher, size = 'medium' }: VouchingBadgeProps) {
  const { client } = useHolochain();
  const [voucher, setVoucher] = useState<VoucherInfo | null>(providedVoucher || null);
  const [isLoading, setIsLoading] = useState(!providedVoucher);

  useEffect(() => {
    // If voucher info is provided, use it
    if (providedVoucher !== undefined) {
      setVoucher(providedVoucher);
      setIsLoading(false);
      return;
    }

    // Otherwise, fetch it for the current user
    async function fetchVoucher() {
      if (!client) {
        setIsLoading(false);
        return;
      }

      try {
        const voucherInfo = await getVoucherInfo(client);
        setVoucher(voucherInfo);
        logger.debug('Voucher info fetched', { 
          hasVoucher: !!voucherInfo,
          nickname: voucherInfo?.nickname 
        });
      } catch (err) {
        logger.error('Error fetching voucher info', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVoucher();
  }, [client, providedVoucher]);

  // Don't show anything if no voucher or still loading
  if (isLoading || !voucher) {
    return null;
  }

  return (
    <div 
      className={`vouching-badge vouching-badge--${size}`}
      title={`Vouched for by ${voucher.nickname}`}
    >
      <span className="vouching-badge__icon">🛡️</span>
      <span className="vouching-badge__text">
        Vouched by <strong>{voucher.nickname}</strong>
      </span>
    </div>
  );
}
