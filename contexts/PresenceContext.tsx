import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { AppState, AppStateStatus } from 'react-native';

interface PresenceContextType {
  onlineUserIds: Set<string>;
  isUserOnline: (userId: string) => boolean;
  lastSeenMap: Record<string, string>; // userId -> ISO string
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});
  const channelRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);

  const syncPresence = useCallback(() => {
    if (!channelRef.current) return;
    const state = channelRef.current.presenceState();
    const onlineIds = new Set<string>(Object.keys(state).map(k => k.toLowerCase()));
    setOnlineUserIds(onlineIds);
    console.log('[Presence] Real-time Sync complete. Online IDs:', Array.from(onlineIds));
  }, []);

  const trackSelf = useCallback(async () => {
    if (!user || !channelRef.current) return;
    
    try {
      // 1. Track via Real-time Presence
      if (AppState.currentState === 'active') {
        await channelRef.current.track({
          online_at: new Date().toISOString(),
          status: 'online'
        });
      }

      // 2. Track via Database Heartbeat (fallback)
      const { error } = await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (error) console.warn('[Presence] DB Heartbeat error:', error);
      
    } catch (e) {
      console.warn('[Presence] Track/Heartbeat error:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      setLastSeenMap({});
      return;
    }

    console.log('[Presence] Initializing tracking for user:', user.id);

    // 1. Presence Channel
    const channel = supabase.channel('app-global-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

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
        console.log('[Presence] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          await trackSelf();
        }
      });

    // 2. Postgres Changes Subscription (for last_seen_at fallback)
    const profileChannel = supabase.channel('profile-activity-sync')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles' 
      }, (payload) => {
        const { id, last_seen_at } = payload.new;
        if (id && last_seen_at) {
          setLastSeenMap(prev => ({
            ...prev,
            [id.toLowerCase()]: last_seen_at
          }));
        }
      })
      .subscribe();

    // 3. Heartbeat every 20 seconds
    const interval = setInterval(() => {
      trackSelf();
    }, 20000);

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[Presence] App foreground, re-tracking...');
        await trackSelf();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[Presence] App background, untracking...');
        await channel.untrack();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      subscription.remove();
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
      channelRef.current = null;
    };
  }, [user?.id, trackSelf, syncPresence]);

  const isUserOnline = (userId: string) => {
    if (!userId) return false;
    const lowerId = userId.toLowerCase();
    
    // Check 1: Real-time Presence
    if (onlineUserIds.has(lowerId)) return true;
    
    // Check 2: Database Fallback (last seen in last 2 minutes)
    const lastSeen = lastSeenMap[lowerId];
    if (lastSeen) {
      const lastSeenDate = new Date(lastSeen).getTime();
      const now = Date.now();
      if (now - lastSeenDate < 1000 * 60 * 2) { // 2 minutes window
        return true;
      }
    }
    
    return false;
  };

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isUserOnline, lastSeenMap }}>
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
