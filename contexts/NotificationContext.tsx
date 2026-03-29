import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { playNotificationSound } from '@/lib/notification-sound';

interface ToastNotification {
  id: string;
  senderName: string;
  message: string;
  navigateTo: string;
}

interface NotificationContextType {
  activeToast: ToastNotification | null;
  dismissToast: () => void;
  suppressToast: (suppressed: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastNotification | null>(null);
  const { user } = useAuth();
  const suppressedRef = useRef(false);

  const dismissToast = () => {
    setActiveToast(null);
  };

  const suppressToast = (suppressed: boolean) => {
    suppressedRef.current = suppressed;
    if (suppressed) setActiveToast(null);
  };

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Don't show notification if suppressed (e.g. user is on messages page)
          if (suppressedRef.current) {
            return;
          }

          playNotificationSound();

          try {
            let senderName = 'Someone';

            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newMessage.sender_id)
              .maybeSingle();

            if (senderProfile?.full_name) {
              senderName = senderProfile.full_name;
            } else {
              const { data: teammates } = await supabase.rpc('get_team_coaches');
              const match = (teammates || []).find((tm: any) => tm.user_id === newMessage.sender_id);
              if (match?.full_name) senderName = match.full_name;
            }

            let messageText = '';
            try {
              const parsed = JSON.parse(newMessage.content);
              if (parsed.type === 'meal_log') {
                messageText = 'Sent a meal log';
              } else if (parsed.type === 'session_invite') {
                messageText = 'Sent a session invite';
              } else {
                messageText = 'Sent a message';
              }
            } catch {
              messageText = newMessage.content.substring(0, 50);
              if (newMessage.content.length > 50) {
                messageText += '...';
              }
            }

            setActiveToast({
              id: newMessage.id,
              senderName,
              message: messageText,
              navigateTo: '/messages',
            });
          } catch (error) {
            console.error('Error fetching sender info:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ activeToast, dismissToast, suppressToast }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
