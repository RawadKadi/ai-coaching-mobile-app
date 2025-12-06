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

  // Refs to track state inside intervals/callbacks without stale closures
  const currentSessionRef = useRef<any>(null);
  const toastTypeRef = useRef<'join' | 'cancelled' | 'postponed'>('join');
  const isToastVisibleRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    currentSessionRef.current = currentSession;
    toastTypeRef.current = toastType;
    isToastVisibleRef.current = toastVisible;
  }, [currentSession, toastType, toastVisible]);

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
            // Skip if session is cancelled (should be filtered by query, but double check)
            if (session.status === 'cancelled') continue;

            // Skip if we are already showing a cancelled/postponed toast for this session
            // USE REFS TO CHECK CURRENT STATE
            if (currentSessionRef.current?.id === session.id && (toastTypeRef.current === 'cancelled' || toastTypeRef.current === 'postponed')) {
              console.log('[SessionMonitor] Skipping join toast because session is already cancelled/postponed (Ref Check)');
              continue;
            }

            if (coach && !session.invite_sent) {
              await sendInvite(session);
            }
            
            const sessionTime = new Date(session.scheduled_at).getTime();
            const timeDiff = Math.abs(now.getTime() - sessionTime);
            
            // CRITICAL: Re-fetch the specific session to ensure we have the absolute latest status
            const { data: freshSession, error: freshError } = await supabase
              .from('sessions')
              .select('status, cancellation_reason')
              .eq('id', session.id)
              .single();

            if (freshError || !freshSession) {
               console.log('[SessionMonitor] Failed to verify session status, skipping toast to be safe.');
               continue;
            }

            if (freshSession.status === 'cancelled') {
               console.log('[SessionMonitor] Detected cancelled session in poller, switching to cancel toast');
               handleSessionUpdate({ ...session, ...freshSession });
               continue;
            }

            if (freshSession.status !== 'scheduled') continue;

            if (timeDiff < 45000) {
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
          console.log('[SessionMonitor] Realtime UPDATE received:', payload.new);
          const updatedSession = payload.new as any;
          
          let isRelevant = false;
          if (coach && updatedSession.coach_id === coach.id) isRelevant = true;
          if (!coach) {
             // Use Ref to check current session ID
             if (currentSessionRef.current && currentSessionRef.current.id === updatedSession.id) isRelevant = true;
          }

          if (!isRelevant && !currentSessionRef.current) return;

          // If we have an active toast for this session, update it
          if (currentSessionRef.current && currentSessionRef.current.id === updatedSession.id) {
             handleSessionUpdate(updatedSession);
          } else if (isRelevant) {
             const now = new Date();
             const sessionTime = new Date(updatedSession.scheduled_at).getTime();
             if (Math.abs(now.getTime() - sessionTime) < 5 * 60 * 1000) {
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
  }, [user, coach]); // Minimal dependencies

  // 3. Fast polling for ACTIVE session status (Fallback for realtime)
  useEffect(() => {
    const checkActiveSession = async () => {
      const activeSession = currentSessionRef.current;
      if (!activeSession) return;

      try {
        const { data: session, error } = await supabase
          .from('sessions')
          .select('*, clients(profiles(full_name)), coaches(profiles(full_name))')
          .eq('id', activeSession.id)
          .single();

        if (error || !session) return;

        // If status changed to cancelled, update UI immediately
        if (session.status === 'cancelled') {
           // Only update if we aren't already showing it as cancelled/postponed
           if (toastTypeRef.current === 'join') {
              console.log('[SessionMonitor] Active session cancelled/postponed (Fast Poll):', session);
              handleSessionUpdate(session);
           }
        }
      } catch (e) {
        console.error('Error checking active session:', e);
      }
    };

    const activeInterval = setInterval(checkActiveSession, 3000); // Check every 3 seconds
    return () => clearInterval(activeInterval);
  }, []); // Empty dependency array - uses refs!

  const handleSessionUpdate = async (session: any) => {
    // Fetch names if needed
    const { data: fullSession } = await supabase
      .from('sessions')
      .select('*, clients(profiles(full_name)), coaches(profiles(full_name))')
      .eq('id', session.id)
      .single();
      
    if (!fullSession) return;

    if (session.status === 'cancelled') {
      console.log('[SessionMonitor] Handling cancellation. Reason:', session.cancellation_reason);
      if (session.cancellation_reason) {
        // Postponed
        if (coach) {
          // Coach View: Client postponed
          const clientName = fullSession.clients?.profiles?.full_name || 'Client';
          showToast(`${clientName} ${session.cancellation_reason}`, fullSession, 'postponed');
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
    // SAFEGUARD: Don't overwrite a cancelled/postponed toast with a 'join' toast for the same session
    // Use REFS for check
    if (type === 'join' && currentSessionRef.current?.id === session.id && (toastTypeRef.current === 'cancelled' || toastTypeRef.current === 'postponed')) {
      console.log('[SessionMonitor] Blocking join toast because session is already cancelled/postponed');
      return;
    }

    // Always update state to reflect new status/message
    setToastMessage(message);
    setCurrentSession(session);
    setToastType(type);
    setToastVisible(true);
    
    // Only animate if not already visible
    if (!isToastVisibleRef.current) {
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
