import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Video, X, AlertCircle, Clock } from 'lucide-react-native';

export default function SessionMonitor() {
  const { user, coach } = useAuth();
  const router = useRouter();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [toastType, setToastType] = useState<'join' | 'cancelled' | 'postponed'>('join');
  const slideAnim = useRef(new Animated.Value(-150)).current;

  useEffect(() => {
    if (!user) return;

    // 1. Polling for NEW sessions (starting now)
    const checkSessions = async () => {
      try {
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
        const oneMinuteFromNow = new Date(now.getTime() + 1 * 60 * 1000).toISOString();

        let query = supabase
          .from('sessions')
          .select('*, clients(profiles(full_name)), coaches(profiles(full_name))')
          .eq('status', 'scheduled')
          .lte('scheduled_at', oneMinuteFromNow)
          .gte('scheduled_at', twoMinutesAgo);

        if (coach) {
          query = query.eq('coach_id', coach.id);
        } else {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (clientData) {
            query = query.eq('client_id', clientData.id);
          } else {
            return;
          }
        }

        const { data: sessions, error } = await query;

        if (error) throw error;

        if (sessions && sessions.length > 0) {
          for (const session of sessions) {
            if (coach && !session.invite_sent) {
              await sendInvite(session);
            }
            
            const sessionTime = new Date(session.scheduled_at).getTime();
            const timeDiff = Math.abs(now.getTime() - sessionTime);
            
            // Double check status just in case
            if (session.status === 'scheduled' && timeDiff < 45000) {
               const otherName = coach 
                 ? (session.clients?.profiles?.full_name || 'Client')
                 : (session.coaches?.profiles?.full_name || 'Coach');
               
               showToast(`Session with ${otherName} starts now!`, session, 'join');
            }
          }
        }
      } catch (error) {
        console.error('Session monitor error:', error);
      }
    };

    const interval = setInterval(checkSessions, 30000);
    checkSessions();

    // 2. Real-time Subscription for UPDATES (Cancel/Postpone)
    const channel = supabase
      .channel('session-monitor-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
        },
        async (payload) => {
          const updatedSession = payload.new as any;
          
          // Check if this session is relevant to us
          // We need to fetch the names again since payload doesn't have relations
          // But first, simple check if we are involved
          // Note: We can't easily check coach_id/client_id against ours without fetching our IDs first or storing them.
          // 'coach' object has 'id'. 'user' has 'id'.
          
          let isRelevant = false;
          if (coach && updatedSession.coach_id === coach.id) isRelevant = true;
          if (!coach) {
             // For client, we need to know our client_id. 
             // We could store it in state, but for now let's just fetch if we don't have it.
             // Optimization: Fetch client_id once in useEffect.
             // For now, let's assume if we are showing a toast for this session, it's relevant.
             if (currentSession && currentSession.id === updatedSession.id) isRelevant = true;
          }

          if (!isRelevant && !currentSession) return; // Skip if not relevant and no active toast

          // If we have an active toast for this session, update it
          if (currentSession && currentSession.id === updatedSession.id) {
             handleSessionUpdate(updatedSession);
          } else if (isRelevant) {
             // If it's a relevant session but no toast is showing, 
             // maybe we should show one if it was JUST cancelled/postponed and it was scheduled for "now"?
             // For simplicity, let's only update if toast is visible OR if it's a very recent session.
             const now = new Date();
             const sessionTime = new Date(updatedSession.scheduled_at).getTime();
             if (Math.abs(now.getTime() - sessionTime) < 5 * 60 * 1000) { // Within 5 mins
                handleSessionUpdate(updatedSession);
             }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, coach, currentSession]);

  // 3. Fast polling for ACTIVE session status (Fallback for realtime)
  useEffect(() => {
    if (!currentSession) return;

    const checkActiveSession = async () => {
      try {
        const { data: session, error } = await supabase
          .from('sessions')
          .select('*, clients(profiles(full_name)), coaches(profiles(full_name))')
          .eq('id', currentSession.id)
          .single();

        if (error || !session) return;

        // If status changed to cancelled, update UI immediately
        if (session.status === 'cancelled') {
           console.log('[SessionMonitor] Active session cancelled/postponed:', session);
           handleSessionUpdate(session);
        }
      } catch (e) {
        console.error('Error checking active session:', e);
      }
    };

    const activeInterval = setInterval(checkActiveSession, 3000); // Check every 3 seconds
    return () => clearInterval(activeInterval);
  }, [currentSession, toastType]);

  const handleSessionUpdate = async (session: any) => {
    // Fetch names if needed
    const { data: fullSession } = await supabase
      .from('sessions')
      .select('*, clients(profiles(full_name)), coaches(profiles(full_name))')
      .eq('id', session.id)
      .single();
      
    if (!fullSession) return;

    const otherName = coach 
      ? (fullSession.clients?.profiles?.full_name || 'Client')
      : (fullSession.coaches?.profiles?.full_name || 'Coach');

    if (session.status === 'cancelled') {
      console.log('[SessionMonitor] Handling cancellation. Reason:', session.cancellation_reason);
      if (session.cancellation_reason) {
        // Postponed
        if (coach) {
          // Coach View: Client postponed
          const clientName = fullSession.clients?.profiles?.full_name || 'Client';
          showToast(`${clientName} postponed: ${session.cancellation_reason}`, fullSession, 'postponed');
        } else {
          // Client View: You postponed
          showToast(`You postponed this session. Your coach will be notified.`, fullSession, 'postponed');
        }
      } else {
        // Cancelled - Always by Coach
        const coachName = fullSession.coaches?.profiles?.full_name || 'Coach';
        showToast(`Session cancelled by ${coachName}`, fullSession, 'cancelled');
      }
    }
  };

  const sendInvite = async (session: any) => {
    try {
      const messageContent = JSON.stringify({
        type: 'session_invite',
        description: 'Scheduled Session',
        timestamp: session.scheduled_at,
        link: session.meet_link,
        sessionId: session.id
      });

      // Get recipient ID (Client's User ID)
      const { data: clientData } = await supabase
        .from('clients')
        .select('user_id')
        .eq('id', session.client_id)
        .single();
      
      if (!clientData) return;

      await supabase.from('messages').insert({
        sender_id: user?.id,
        recipient_id: clientData.user_id,
        content: messageContent,
        message_type: 'call_invite',
        read: false
      });

      await supabase.from('sessions').update({ invite_sent: true }).eq('id', session.id);
    } catch (error) {
      console.error('Error sending invite:', error);
    }
  };

  const showToast = (message: string, session: any, type: 'join' | 'cancelled' | 'postponed') => {
    // Always update state to reflect new status/message
    setToastMessage(message);
    setCurrentSession(session);
    setToastType(type);
    setToastVisible(true);
    
    // Only animate if not already visible (or maybe just ensure it stays visible)
    if (!toastVisible) {
        Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        }).start();
    }
  };

  const hideToast = () => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setToastVisible(false);
      setCurrentSession(null);
    });
  };

  const handleAction = () => {
    if (!currentSession) return;

    if (toastType === 'join') {
      if (coach) {
        router.push(`/(coach)/chat/${currentSession.client_id}`);
      } else {
        router.push('/(client)/(tabs)/chat'); 
      }
    } else if (toastType === 'postponed' && coach) {
      // Check Up Logic
      const reason = currentSession.cancellation_reason?.toLowerCase() || '';
      let suggestedMessage = "Hey, is everything alright? Any reason why you postponed?";
      
      if (reason.includes('sick') || reason.includes('ill') || reason.includes('health') || reason.includes('feeling')) {
        suggestedMessage = "Oh hope you're doing well... Get well soon! Let me know when you're feeling better.";
      } else if (reason.includes('work') || reason.includes('busy') || reason.includes('meeting')) {
        suggestedMessage = "No worries, work comes first! Let's reschedule when you're free.";
      } else if (reason.includes('family') || reason.includes('emergency') || reason.includes('personal')) {
        suggestedMessage = "Oh hope you're doing good, see you tomorrow! Take your time.";
      } else if (reason.includes('other')) {
         suggestedMessage = "Is everything okay? Any reason why you postponed?";
      }

      // Navigate to chat with suggested message
      router.push({
        pathname: `/(coach)/chat/${currentSession.client_id}`,
        params: { suggestedMessage }
      });
    }
    
    hideToast();
  };

  if (!toastVisible) return null;

  const getToastStyle = () => {
    switch (toastType) {
      case 'cancelled': return { backgroundColor: '#EF4444' }; // Red
      case 'postponed': return { backgroundColor: '#EAB308' }; // Yellow
      default: return { backgroundColor: '#10B981' }; // Green
    }
  };

  const getTextColor = () => {
    switch (toastType) {
      case 'postponed': return '#854D0E'; // Dark Yellow
      default: return '#ECFDF5'; // Light Green/Red
    }
  };

  const getButtonText = () => {
    if (toastType === 'join') return 'Join';
    if (toastType === 'postponed' && coach) return 'Check Up';
    return null; // No button for cancelled or client postponed view (unless we want one)
  };

  return (
    <SafeAreaView style={styles.container} pointerEvents="box-none">
      <Animated.View style={[styles.toast, getToastStyle(), { transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={styles.content} onPress={handleAction} disabled={!getButtonText()}>
          <View style={styles.iconContainer}>
            {toastType === 'join' && <Video size={24} color="#FFFFFF" />}
            {toastType === 'cancelled' && <X size={24} color="#FFFFFF" />}
            {toastType === 'postponed' && <Clock size={24} color="#FFFFFF" />}
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, toastType === 'postponed' && { color: '#FFFFFF' }]}>
              {toastType === 'join' ? 'Session Starting' : (toastType === 'postponed' ? 'Session Postponed' : 'Session Cancelled')}
            </Text>
            <Text style={[styles.message, { color: getTextColor() }, toastType === 'postponed' && { color: '#FEFCE8' }]}>
              {toastMessage}
            </Text>
          </View>
          {getButtonText() && (
            <View style={styles.button}>
              <Text style={[styles.buttonText, { color: toastType === 'postponed' ? '#EAB308' : '#10B981' }]}>
                {getButtonText()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeButton} onPress={hideToast}>
          <X size={20} color={toastType === 'postponed' ? '#FFFFFF' : '#ECFDF5'} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    width: '90%',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: Platform.OS === 'android' ? 40 : 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 12,
  },
  closeButton: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.2)',
  },
});
