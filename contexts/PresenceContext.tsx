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

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[Presence] AppState changed to:', nextAppState);
      if (nextAppState === 'active') {
        // When coming back to active, re-track. If socket closed, real-time will re-subscribe automatically.
        if (channel.state === 'joined') {
          await channel.track({ online_at: new Date().toISOString() });
        } else {
          channel.subscribe();
        }
      } else {
        // Going to background - opt-out of untrack if we want to rely on server-side timeout,
        // but for "only when app is opened", untrack is correct.
        await channel.untrack();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log('[Presence] Cleaning up channel');
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
