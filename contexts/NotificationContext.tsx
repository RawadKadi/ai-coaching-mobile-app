import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastNotification | null>(null);
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Check if user is currently on messages page
  const isOnMessagesPage = () => {
    const path = segments.join('/');
    return path.includes('messages') || path.includes('chat');
  };

  const dismissToast = () => {
    setActiveToast(null);
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

          // Don't show notification if user is on messages page
          if (isOnMessagesPage()) {
            return;
          }

          playNotificationSound();

          try {
            let senderName = 'Someone';

            // 1. Try direct profiles query (works for client → coach messages where RLS allows it)
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newMessage.sender_id)
              .maybeSingle();

            if (senderProfile?.full_name) {
              senderName = senderProfile.full_name;
            } else {
              // 2. RLS blocked profiles read (coach sender) — use get_team_coaches RPC which is SECURITY DEFINER
              const { data: teammates } = await supabase.rpc('get_team_coaches');
              const match = (teammates || []).find((tm: any) => tm.user_id === newMessage.sender_id);
              if (match?.full_name) senderName = match.full_name;
            }

            // Parse message content (could be JSON or plain text)
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
              // Plain text message — show actual content preview
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
  }, [user?.id, segments]);

  return (
    <NotificationContext.Provider value={{ activeToast, dismissToast }}>
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
