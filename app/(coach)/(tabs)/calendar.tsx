import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Platform, RefreshControl, ScrollView, Animated, StatusBar, Dimensions, Alert, Modal, TouchableOpacity } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, Clock, Video, ChevronRight, User, Plus, Zap, AlertCircle, Search, ChevronsLeftRight, CalendarDays, Trash2, Pen, MessageSquare, X } from 'lucide-react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import SchedulerModal from '@/components/SchedulerModal';
import { DatePickerOverlay } from '@/components/DatePickerOverlay';
import ManualSchedulerModal from '@/components/ManualSchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import PostponeModal from '@/components/PostponeModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CALENDAR_BOX_MARGIN = 24;
const CALENDAR_BOX_PADDING = 24;
const PAGE_WIDTH = SCREEN_WIDTH - (CALENDAR_BOX_MARGIN * 2) - (CALENDAR_BOX_PADDING * 2);

import CalendarTwoWeekPage from '@/components/CalendarTwoWeekPage';
import { CalendarSkeleton } from '@/components/CalendarSkeleton';

interface AnimatedSessionCardProps {
    session: any;
    onPress: () => void;
    onLongPress?: () => void;
}

const AnimatedSessionCard = React.memo(({ session, onPress, onLongPress }: AnimatedSessionCardProps) => {
    const colors = useBrandColors();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const isPostponed = session.status === 'postponed' || (session.status === 'cancelled' && session.cancellation_reason?.toLowerCase().includes('postpone'));
    const isCancelled = session.status === 'cancelled' && !isPostponed;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1.0,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4
        }).start();
    };

    return (
        <Pressable 
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={200}
        >
            {({ pressed }) => (
                <Animated.View 
                    style={[
                        { transform: [{ scale: scaleAnim }] },
                        {
                            backgroundColor: isPostponed 
                                ? 'rgba(234, 179, 8, 0.08)' 
                                : isCancelled 
                                    ? 'rgba(239, 68, 68, 0.08)' 
                                    : colors.surface,
                            borderColor: isPostponed 
                                ? 'rgba(234, 179, 8, 0.25)' 
                                : isCancelled 
                                    ? 'rgba(239, 68, 68, 0.25)' 
                                    : colors.border,
                        }
                    ]}
                    className="border rounded-[36px] p-6 flex-row items-center"
                >
                    {/* Left: Time */}
                    <View className="items-center mr-4 w-16">
                        <Text style={{ color: isPostponed || isCancelled ? colors.text : colors.primary }} className="font-black text-lg">
                            {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text style={{ color: colors.textSecondary }} className="font-black text-[10px] uppercase">
                            {new Date(session.scheduled_at).getHours() >= 12 ? 'PM' : 'AM'}
                        </Text>
                    </View>

                    {/* Vertical Line */}
                    <View className={`w-[2px] h-12 rounded-full mr-6 ${isPostponed ? 'bg-yellow-500/20' : isCancelled ? 'bg-red-500/20' : 'bg-blue-600/30'}`} />

                    {/* Middle: Info */}
                    <View className="flex-1">
                        <Text style={{ color: colors.text }} className="font-black text-lg tracking-tight leading-tight mb-1">
                            {session.session_type === 'video' ? 'Performance Video Call' : 'Strategic Coaching'}
                        </Text>
                        <Text style={{ color: colors.textSecondary }} className="font-bold text-xs">
                            {session.client?.profiles?.full_name} • 60 min
                        </Text>
                    </View>

                    {/* Right: Avatar & Icon */}
                    <View className="flex-row items-center gap-2">
                        <BrandedAvatar 
                            name={session.client?.profiles?.full_name} 
                            imageUrl={session.client?.profiles?.avatar_url} 
                            size={32} 
                        />
                        {isPostponed ? (
                            <View className="w-8 h-8 rounded-full bg-yellow-500/10 items-center justify-center">
                                <Clock size={14} color="#EAB308" />
                            </View>
                        ) : isCancelled ? (
                            <View className="w-8 h-8 rounded-full bg-red-500/10 items-center justify-center">
                                <X size={14} color="#EF4444" />
                            </View>
                        ) : (
                            <View className="w-8 h-8 rounded-full bg-cyan-400/20 items-center justify-center">
                                <Video size={14} color="#22D3EE" />
                            </View>
                        )}
                    </View>
                </Animated.View>
            )}
        </Pressable>
    );
});


AnimatedSessionCard.displayName = 'AnimatedSessionCard';

export default function CalendarScreen() {
  const { profile, coach } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const { primary, secondary } = colors;
  const { handleScroll } = useTabBarScroll();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewingMonth, setViewingMonth] = useState(new Date());
  const [showManualScheduler, setShowManualScheduler] = useState(false);
  const [showAIScheduler, setShowAIScheduler] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [initialClientData, setInitialClientData] = useState<any>(null);
  
  // Gesture & Actions states for session management
  const swipeableRefs = useRef<{ [key: string]: SwipeableMethods | null }>({});
  const [selectedSessionForMenu, setSelectedSessionForMenu] = useState<any>(null);
  const [sessionToEdit, setSessionToEdit] = useState<any>(null);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [currentlyOpenSessionId, setCurrentlyOpenSessionId] = useState<string | null>(null);

  const closeAllSwipes = useCallback(() => {
    if (currentlyOpenSessionId) {
      swipeableRefs.current[currentlyOpenSessionId]?.close();
      setCurrentlyOpenSessionId(null);
    }
  }, [currentlyOpenSessionId]);

  // Cancellation and Postponement Handlers
  const handleLongPressSession = (session: any) => {
    setSelectedSessionForMenu(session);
  };

  const handlePostponeDirect = (session: any) => {
    setSessionToEdit(session);
    setShowPostponeModal(true);
  };

  const handleCancelSessionConfirm = (session: any) => {
    Alert.alert(
      'Cancel Call',
      'Do you want to cancel this call?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => performCancelSession(session) }
      ],
      { cancelable: true }
    );
  };

  const performCancelSession = async (session: any) => {
    try {
      setLoading(true);
      // 1. Update session status to cancelled
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'cancelled', cancellation_reason: 'Cancelled from Calendar' })
        .eq('id', session.id);
      
      if (error) throw error;

      // 2. Find and update matching message referencing this session in public.messages
      const { data: dbMessages } = await supabase
        .from('messages')
        .select('*')
        .ilike('content', `%${session.id}%`);
      
      if (dbMessages) {
        for (const msg of dbMessages) {
          try {
            const p = JSON.parse(msg.content);
            if (p.sessionId !== session.id) continue;
            
            const updatedContent = JSON.stringify({
              ...p,
              status: 'cancelled',
              cancellation_reason: 'Cancelled from Calendar'
            });
            
            await supabase.from('messages').update({ content: updatedContent }).eq('id', msg.id);
          } catch (err) {
            console.error('Error updating message content:', err);
          }
        }
      }

      // Reload sessions to refresh UI
      await loadSessions();
    } catch (e: any) {
      console.error('Error cancelling session:', e);
      Alert.alert('Error', 'Failed to cancel session: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostponeConfirm = async (reason: string, newDate: string) => {
    if (!sessionToEdit) return;
    try {
      setLoading(true);
      
      // 1. Cancel the old session
      const { error: cancelError } = await supabase
        .from('sessions')
        .update({
          status: 'cancelled',
          cancellation_reason: `Postponed: ${reason}`
        })
        .eq('id', sessionToEdit.id);
      
      if (cancelError) throw cancelError;

      // 2. Create the new session
      const { error: insertError } = await supabase
        .from('sessions')
        .insert({
          coach_id: sessionToEdit.coach_id,
          client_id: sessionToEdit.client_id,
          scheduled_at: newDate,
          duration_minutes: sessionToEdit.duration_minutes || 60,
          session_type: sessionToEdit.session_type || 'training',
          status: 'scheduled',
          is_locked: true,
          meet_link: sessionToEdit.meet_link || `https://meet.google.com/new`,
          notes: `Postponed from ${new Date(sessionToEdit.scheduled_at).toLocaleDateString()}`
        });

      if (insertError) throw insertError;

      // 3. Update old message content
      const { data: dbMessages } = await supabase
        .from('messages')
        .select('*')
        .ilike('content', `%${sessionToEdit.id}%`);
      
      if (dbMessages) {
        for (const msg of dbMessages) {
          try {
            const p = JSON.parse(msg.content);
            if (p.sessionId !== sessionToEdit.id) continue;
            
            const updatedContent = JSON.stringify({
              ...p,
              status: 'cancelled',
              cancellation_reason: `Postponed: ${reason}`,
              postponedTo: newDate,
              postponedAt: new Date().toISOString()
            });
            
            await supabase.from('messages').update({ content: updatedContent }).eq('id', msg.id);
          } catch (err) {
            console.error('Error updating message content:', err);
          }
        }
      }

      // Reload sessions
      await loadSessions();
      setShowPostponeModal(false);
      setSessionToEdit(null);
    } catch (e: any) {
      console.error('Error postponing session:', e);
      Alert.alert('Error', 'Failed to postpone session: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Animation scales for buttons
  const calendarBtnScale = useRef(new Animated.Value(1)).current;
  const plusBtnScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (scaleAnim: Animated.Value) => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  const handlePressOut = (scaleAnim: Animated.Value) => {
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };
  
  const PAGE_INDICES = Array.from({ length: 101 }, (_, i) => i - 50); // -50 to 50 pages (approx 2 years)
  const INITIAL_PAGE_INDEX = 50;
  const flatListRef = useRef<FlatList>(null);

  const getPageIndexForDate = (targetDate: Date) => {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - diff);
    startOfThisWeek.setHours(0, 0, 0, 0);

    const target = new Date(targetDate);
    const targetDay = target.getDay();
    const targetDiff = (targetDay === 0 ? 6 : targetDay - 1);
    const startOfTargetWeek = new Date(target);
    startOfTargetWeek.setDate(target.getDate() - targetDiff);
    startOfTargetWeek.setHours(0, 0, 0, 0);

    const diffMs = startOfTargetWeek.getTime() - startOfThisWeek.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 14);
  };

  const scrollToDate = (date: Date) => {
    const pageIndex = getPageIndexForDate(date);
    const arrayIndex = Math.max(0, Math.min(100, pageIndex + 50));
    flatListRef.current?.scrollToIndex({
      index: arrayIndex,
      animated: true,
    });
  };
 
  useEffect(() => {
    const fetchClientData = async () => {
      if (selectedClient && showManualScheduler && !showAIScheduler) {
        const { data } = await supabase.from('clients').select('id, user_id, profiles(full_name, avatar_url)').eq('id', selectedClient.id).single();
        if (data) setInitialClientData(data);
      } else if (!showManualScheduler) setInitialClientData(null);
    };
    fetchClientData();
  }, [selectedClient, showManualScheduler, showAIScheduler]);

  useFocusEffect(useCallback(() => {
    if (profile) loadSessions();
    if (params?.resetToToday === 'true') {
      const today = new Date();
      setSelectedDate(today);
      setViewingMonth(today);
      setTimeout(() => {
        scrollToDate(today);
      }, 100);
      router.setParams({ resetToToday: '' });
    }
  }, [profile, params?.resetToToday]));

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('sessions').select('*, client:clients(profiles(full_name, avatar_url))').eq('coach_id', coach?.id).order('scheduled_at', { ascending: true });
      if (error) throw error;
      setSessions(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };  const sessionDatesSet = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.scheduled_at) {
        set.add(new Date(s.scheduled_at).toDateString());
      }
    }
    return set;
  }, [sessions]);

  const currentDaySessions = React.useMemo(() => {
    const targetStr = selectedDate.toDateString();
    return sessions.filter(s => new Date(s.scheduled_at).toDateString() === targetStr);
  }, [sessions, selectedDate]);

  const getDaysForPage = (pageIndex: number) => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      const day = d.getDay();
      const diff = (day === 0 ? 6 : day - 1);
      d.setDate(d.getDate() - diff + (pageIndex * 14) + i);
      return d;
    });
  };

  const renderCalendarPage = useCallback(({ item: pageIndex }: { item: number }) => {
    return (
      <CalendarTwoWeekPage
        pageIndex={pageIndex}
        selectedDate={selectedDate}
        onSelectDate={(item) => {
          closeAllSwipes();
          setSelectedDate(item);
        }}
        viewingMonth={viewingMonth}
        sessionDatesSet={sessionDatesSet}
        colors={colors}
        pageWidth={PAGE_WIDTH}
      />
    );
  }, [selectedDate, viewingMonth, sessionDatesSet, colors, closeAllSwipes]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const pageIndex = viewableItems[0].item;
      const pageDays = getDaysForPage(pageIndex);
      setViewingMonth(pageDays[0]);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;  
  
  if (loading && !refreshing) return <CalendarSkeleton showBackButton={false} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <View className="px-6 pt-10 pb-4">
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.text }} className="text-4xl font-black tracking-tight mb-2">
                    {viewingMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                {/* Date picker trigger */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View 
                    style={[{ backgroundColor: colors.surface, borderColor: colors.border }]}
                    className="w-10 h-10 rounded-2xl items-center justify-center border mb-2"
                  >
                    <CalendarDays size={18} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textSecondary }} className="font-medium">
                  You have {currentDaySessions.length} sessions scheduled for today.
              </Text>
          </View>
          <View className="px-8 flex-row justify-end mb-2 opacity-40">
              <View className="flex-row items-center gap-1">
                  <ChevronsLeftRight size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase">Swipe</Text>
              </View>
          </View>
          {/* Calendar Box */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="rounded-[48px] p-6 mx-6 my-4 border">
              <View className="flex-row justify-between mb-6 px-2">
                  <View className="flex-row flex-1 justify-between">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                        <View key={i} className="flex-1 items-center">
                            <Text style={{ color: colors.textSecondary }} className="text-[9px] font-black">{day}</Text>
                        </View>
                    ))}
                  </View>
              </View>
              
              <FlatList
                  ref={flatListRef}
                  horizontal
                  pagingEnabled
                  snapToInterval={PAGE_WIDTH}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  data={PAGE_INDICES}
                  keyExtractor={(item) => item.toString()}
                  initialScrollIndex={INITIAL_PAGE_INDEX}
                  getItemLayout={(_, index) => ({
                      length: PAGE_WIDTH,
                      offset: PAGE_WIDTH * index,
                      index,
                  })}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  renderItem={renderCalendarPage}
              />
          </View>

          <ScrollView 
              className="flex-1 px-4 mt-6"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} tintColor={primary} />}
              onScrollBeginDrag={closeAllSwipes}
          >
              <View className="mb-6 mt-4">
                  <Text style={{ color: colors.text }} className="text-2xl font-black tracking-tight">Today's Focus</Text>
              </View>

              <View className="space-y-4">
                  {currentDaySessions.length === 0 ? (
                      <View style={{ backgroundColor: isDarkMode ? 'rgba(15,23,42,0.2)' : 'rgba(0,0,0,0.02)', borderColor: colors.border }} className="p-16 items-center justify-center rounded-[48px] border border-dashed">
                          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="w-20 h-20 rounded-[32px] items-center justify-center border mb-6">
                              <CalendarIcon size={32} color={colors.primary} />
                          </View>
                          <Text style={{ color: colors.text }} className="font-black text-xs uppercase tracking-widest text-center">Day Clear</Text>
                          <Text style={{ color: colors.textSecondary }} className="font-medium text-[10px] mt-2 text-center px-6 leading-5">You have no live coaching sessions scheduled for this date.</Text>
                      </View>
                  ) : (
                      currentDaySessions.map((session) => {
                          const isPostponed = session.status === 'postponed' || (session.status === 'cancelled' && session.cancellation_reason?.toLowerCase().includes('postpone'));
                          const isCancelled = session.status === 'cancelled' && !isPostponed;
                          return (
                              <View key={session.id} className="mb-4">
                                  <Swipeable
                                       ref={ref => { if (ref) swipeableRefs.current[session.id] = ref; }}
                                       enabled={!isCancelled && !isPostponed}
                                       onSwipeableWillOpen={() => {
                                           if (currentlyOpenSessionId && currentlyOpenSessionId !== session.id) {
                                               swipeableRefs.current[currentlyOpenSessionId]?.close();
                                           }
                                           setCurrentlyOpenSessionId(session.id);
                                       }}
                                       renderRightActions={() => (
                                           <View className="flex-row items-center pl-4 pr-2">
                                               {/* Postpone/Reschedule (Yellow Circle) */}
                                               <TouchableOpacity 
                                                   onPress={() => {
                                                       swipeableRefs.current[session.id]?.close();
                                                       setCurrentlyOpenSessionId(null);
                                                       handlePostponeDirect(session);
                                                   }}
                                                   className="w-12 h-12 rounded-full bg-yellow-600 items-center justify-center mr-3 shadow-lg shadow-yellow-600/30"
                                               >
                                                   <Clock size={18} color="white" />
                                               </TouchableOpacity>

                                               {/* Delete/Trash (Red Circle) */}
                                               <TouchableOpacity 
                                                   onPress={() => {
                                                       swipeableRefs.current[session.id]?.close();
                                                       setCurrentlyOpenSessionId(null);
                                                       handleCancelSessionConfirm(session);
                                                   }}
                                                   className="w-12 h-12 rounded-full bg-red-600 items-center justify-center shadow-lg shadow-red-600/30"
                                               >
                                                   <Trash2 size={18} color="white" />
                                               </TouchableOpacity>
                                           </View>
                                       )}
                                   >
                                       <AnimatedSessionCard 
                                           session={session}
                                           onPress={() => {
                                               if (currentlyOpenSessionId) {
                                                   closeAllSwipes();
                                               } else {
                                                   router.push({ pathname: '/(coach)/chat/[id]', params: { id: session.client_id } });
                                               }
                                           }}
                                           onLongPress={() => {
                                               if (currentlyOpenSessionId) {
                                                   closeAllSwipes();
                                               } else {
                                                   handleLongPressSession(session);
                                               }
                                           }}
                                       />
                                   </Swipeable>
                              </View>
                          );
                      })
                  )}
              </View>
          </ScrollView>

           <Pressable 
               onPressIn={() => handlePressIn(plusBtnScale)}
               onPressOut={() => handlePressOut(plusBtnScale)}
               onPress={() => setShowManualScheduler(true)}
               style={{ 
                   bottom: insets.bottom + 90, 
                   position: 'absolute',
                   right: 24,
                   zIndex: 50
               }}
           >
               {({ pressed }) => (
                   <Animated.View 
                       style={[{ transform: [{ scale: plusBtnScale }], backgroundColor: primary, shadowColor: primary }]}
                       className={`w-16 h-16 rounded-full items-center justify-center shadow-2xl border border-white/10 `}
                   >
                       <Plus size={32} color={colors.textOnPrimary || "white"} />
                   </Animated.View>
               )}
           </Pressable>


          {coach && (
              <ManualSchedulerModal 
                  visible={showManualScheduler} 
                  onClose={() => { setShowManualScheduler(false); setSelectedClient(null); }} 
                  onConfirm={async () => loadSessions()} 
                  existingSessions={sessions} coachId={coach.id} initialClient={initialClientData}
                  onSwitchToAI={(c) => { setSelectedClient({ id: c.id, name: c.profiles.full_name, avatar_url: c.profiles.avatar_url, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); setShowManualScheduler(false); setShowAIScheduler(true); }}
              />
          )}
          {selectedClient && (
              <SchedulerModal 
                  visible={showAIScheduler} 
                  onClose={() => { setShowAIScheduler(false); setSelectedClient(null); }} 
                  onConfirm={async () => loadSessions()} 
                  clientContext={selectedClient} targetClientId={selectedClient.id} existingSessions={sessions}
              />
          )}
          {/* Date Picker Overlay */}
          <DatePickerOverlay
            visible={showDatePicker}
            selectedDate={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setViewingMonth(date);
              scrollToDate(date);
            }}
            onClose={() => setShowDatePicker(false)}
          />

          {/* Bottom Sheet Actions Modal (Long Press / Hold) */}
          <Modal 
            visible={!!selectedSessionForMenu} 
            transparent 
            animationType="slide"
            onRequestClose={() => setSelectedSessionForMenu(null)}
          >
              <Pressable 
                className="flex-1 bg-black/60 justify-end" 
                onPress={() => setSelectedSessionForMenu(null)}
              >
                <MotiView 
                    from={{ translateY: 300 }} 
                    animate={{ translateY: 0 }} 
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="rounded-t-[48px] p-8 border-t"
                  >
                      <View style={{ backgroundColor: colors.border }} className="w-12 h-1.5 rounded-full self-center mb-8" />
                      <Text style={{ color: colors.text }} className="text-2xl font-black mb-6 tracking-tight">Session Actions</Text>
                      
                      {selectedSessionForMenu && (selectedSessionForMenu.status !== 'cancelled' && !selectedSessionForMenu.cancellation_reason?.toLowerCase().includes('postpone')) ? (
                        <>
                          <OptionItem 
                              icon={<Clock size={20} color="#EAB308" />} 
                              title="Postpone Session" 
                              sub="Quick postpone using AI slots" 
                              onPress={() => { 
                                  const session = selectedSessionForMenu;
                                  setSelectedSessionForMenu(null); 
                                  handlePostponeDirect(session);
                              }} 
                          />
                          <OptionItem 
                              icon={<Trash2 size={20} color="#EF4444" />} 
                              title="Cancel Session" 
                              sub="Mark session as cancelled" 
                              onPress={() => { 
                                  const session = selectedSessionForMenu;
                                  setSelectedSessionForMenu(null); 
                                  handleCancelSessionConfirm(session);
                              }} 
                          />
                        </>
                      ) : (
                        <Text style={{ color: colors.textSecondary }} className="italic text-center p-4">No actions available for this session</Text>
                      )}
                  </MotiView>
              </Pressable>
          </Modal>


          {/* PostponeModal Integration */}
          {coach && sessionToEdit && (
            <PostponeModal
              visible={showPostponeModal}
              onClose={() => {
                setShowPostponeModal(false);
                setSessionToEdit(null);
              }}
              onConfirm={handlePostponeConfirm}
              coachId={coach.id}
              initialDate={sessionToEdit.scheduled_at}
              clientId={sessionToEdit.client_id}
              sessionId={sessionToEdit.id}
            />
          )}
      </View>
    </View>
  );
}

// Bottom sheet/Action Menu Option Item Helper
const OptionItem = ({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) => {
    const colors = useBrandColors();
    return (
        <Pressable 
            onPress={onPress} 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-row items-center p-4 rounded-3xl border mb-4 active:opacity-80"
        >
            <View style={{ backgroundColor: colors.background, borderColor: colors.border }} className="w-10 h-10 rounded-2xl items-center justify-center border mr-4">
                {icon}
            </View>
            <View className="flex-1">
                <Text style={{ color: colors.text }} className="font-bold text-base">{title}</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5">{sub}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
        </Pressable>
    );
};
