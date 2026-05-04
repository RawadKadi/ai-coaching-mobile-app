import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { AppState, AppStateStatus } from 'react-native';

interface PresenceContextType {
  onlineUserIds: Set<string>;
  isUserOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState();
      const onlineIds = new Set<string>(Object.keys(state));
      setOnlineUserIds(onlineIds);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, ({ key }) => {
        console.log('[Presence] Join:', key);
        syncPresence();
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('[Presence] Leave:', key);
        syncPresence();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Presence] Subscribed, tracking...');
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    const updateLastSeen = async () => {
      if (!user || AppState.currentState !== 'active') return;
      try {
        await supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch (e: any) {
        if (e?.message?.includes('Network request failed')) {
          console.warn('[Presence] Network request failed in heartbeat.');
        } else {
          console.error('[Presence] Error updating last_seen_at:', e);
        }
      }
    };

    // Initial update
    updateLastSeen();

    // Heartbeat every 2 minutes while active
    const heartbeatInterval = setInterval(updateLastSeen, 1000 * 60 * 2);

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[Presence] AppState changed to:', nextAppState);
      if (nextAppState === 'active') {
        updateLastSeen();
        if (channel.state === 'joined') {
          await channel.track({ online_at: new Date().toISOString() });
        } else {
          channel.subscribe();
        }
      } else {
        await channel.untrack();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log('[Presence] Cleaning up channel');
      clearInterval(heartbeatInterval);
      subscription.remove();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  // isUserOnline remains highly reactive because it consumes the state
  const isUserOnline = (userId: string) => {
    if (!userId) return false;
    return onlineUserIds.has(userId);
  };

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
