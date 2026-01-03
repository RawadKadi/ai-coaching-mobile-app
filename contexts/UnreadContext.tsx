import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface UnreadContextType {
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const UnreadContext = createContext<UnreadContextType | undefined>(undefined);

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const refreshUnreadCount = async () => {
    if (!user?.id) return;

    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Load initial count
  useEffect(() => {
    refreshUnreadCount();
  }, [user?.id]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          refreshUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <UnreadContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  const context = useContext(UnreadContext);
  if (context === undefined) {
    throw new Error('useUnread must be used within an UnreadProvider');
  }
  return context;
}
