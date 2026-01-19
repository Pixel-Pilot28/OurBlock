import { useState, useEffect } from 'react';
import { AgentPubKey } from '@holochain/client';
import { useHolochain } from '../contexts/HolochainContext';
import { Profile } from '../types';
import { logger } from '../utils/logger';

// Browser-compatible Uint8Array to hex conversion
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useProfile(agentKey: AgentPubKey | null): Profile | null {
  const { client } = useHolochain();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!client || !agentKey) return;

    async function fetchProfile() {
      try {
        const result = await client!.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_agent_profile',
          payload: agentKey,
        });

        if (result) {
          setProfile(result.profile);
        }
      } catch (err) {
        logger.debug('Could not fetch profile', err);
      }
    }

    fetchProfile();
  }, [client, agentKey ? uint8ArrayToHex(agentKey) : null]);

  return profile;
}

export function useProfiles(agentKeys: AgentPubKey[]): Map<string, Profile> {
  const { client } = useHolochain();
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    if (!client || agentKeys.length === 0) return;

    async function fetchProfiles() {
      const profileMap = new Map<string, Profile>();

      await Promise.all(
        agentKeys.map(async (agentKey) => {
          try {
            const result = await client!.callZome({
              role_name: 'our_block',
              zome_name: 'profile',
              fn_name: 'get_agent_profile',
              payload: agentKey,
            });

            if (result) {
              const key = uint8ArrayToHex(agentKey);
              profileMap.set(key, result.profile);
            }
          } catch (err) {
            logger.debug('Could not fetch profile', err);
          }
        })
      );

      setProfiles(profileMap);
    }

    fetchProfiles();
  }, [client, agentKeys.map(k => uint8ArrayToHex(k)).join(',')]);

  return profiles;
}
