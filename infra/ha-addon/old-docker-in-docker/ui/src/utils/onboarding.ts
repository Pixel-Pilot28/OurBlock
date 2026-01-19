/**
 * Onboarding Utilities
 * 
 * Utilities for detecting first joiners and resolving voucher information
 * to improve the onboarding experience.
 */

import { AppClient } from '@holochain/client';
import { logger } from './logger';

/**
 * Check if the current user is the first joiner in the neighborhood
 * 
 * Logic:
 * - Fetch agent activity for the Hub (from invite code)
 * - Check if Hub's chain length < 10 (new neighborhood threshold)
 * - OR check if only agent in peer list is the Hub
 */
export async function isFirstJoiner(
  client: AppClient,
  hubAgentPubKey: Uint8Array
): Promise<boolean> {
  try {
    // Get all profiles in the neighborhood
    const profiles = await client.callZome({
      role_name: 'our_block',
      zome_name: 'profile',
      fn_name: 'get_all_profiles',
      payload: null,
    });

    logger.debug('First joiner check - profile count', { count: profiles.length });

    // If there's only 1 or 2 profiles (Hub + maybe this user), they're the first
    if (profiles.length <= 2) {
      return true;
    }

    // Get hub's agent activity to check chain length
    try {
      const activity = await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'get_agent_activity_for_agent',
        payload: {
          agent: hubAgentPubKey,
          filter: {
            // Get full activity
            include_rejected: false,
          },
        },
      });

      logger.debug('Hub activity fetched', { 
        chainLength: activity?.valid_activity?.length || 0 
      });

      // If hub's chain length is less than 10, it's a new neighborhood
      if (activity && activity.valid_activity && activity.valid_activity.length < 10) {
        return true;
      }
    } catch (err) {
      // If we can't get hub activity, fall back to profile count check
      logger.warn('Could not fetch hub activity, using profile count', err);
    }

    return false;
  } catch (err) {
    logger.error('Error checking first joiner status', err);
    return false;
  }
}

/**
 * Resolve voucher information from a profile's membrane proof
 * 
 * @param client - Holochain app client
 * @param voucherAgentKey - AgentPubKey of the voucher from membrane proof
 * @returns Voucher's profile information or null if not found
 */
export async function resolveVoucher(
  client: AppClient,
  voucherAgentKey: Uint8Array
): Promise<{ nickname: string; agent: Uint8Array } | null> {
  try {
    // Fetch the voucher's profile
    const voucherProfile = await client.callZome({
      role_name: 'our_block',
      zome_name: 'profile',
      fn_name: 'get_profile_for_agent',
      payload: voucherAgentKey,
    });

    if (!voucherProfile || !voucherProfile.profile) {
      logger.warn('Voucher profile not found', {
        voucherKey: arrayToHex(voucherAgentKey).substring(0, 10),
      });
      return null;
    }

    return {
      nickname: voucherProfile.profile.nickname,
      agent: voucherAgentKey,
    };
  } catch (err) {
    logger.error('Error resolving voucher', err);
    return null;
  }
}

/**
 * Get voucher information from membrane proof stored on the agent's chain
 * 
 * This extracts the voucher's AgentPubKey from the membrane proof signature
 * author and resolves it to a profile name.
 */
export async function getVoucherInfo(
  client: AppClient
): Promise<{ nickname: string; agent: Uint8Array } | null> {
  try {
    // Get the current agent's profile which contains membrane proof info
    const myProfile = await client.callZome({
      role_name: 'our_block',
      zome_name: 'profile',
      fn_name: 'get_my_profile',
      payload: null,
    });

    if (!myProfile) {
      logger.debug('No profile found for current agent');
      return null;
    }

    // Try to get voucher from membrane proof
    // Note: This requires a coordinator function that exposes membrane proof data
    try {
      const membraneProof = await client.callZome({
        role_name: 'our_block',
        zome_name: 'profile',
        fn_name: 'get_my_membrane_proof',
        payload: null,
      });

      if (membraneProof && membraneProof.voucher) {
        return await resolveVoucher(client, membraneProof.voucher);
      }
    } catch (err) {
      // Membrane proof function might not exist yet
      logger.debug('Could not fetch membrane proof (function may not exist)', err);
    }

    return null;
  } catch (err) {
    logger.error('Error getting voucher info', err);
    return null;
  }
}

/**
 * Convert Uint8Array to hex string for logging
 */
function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
