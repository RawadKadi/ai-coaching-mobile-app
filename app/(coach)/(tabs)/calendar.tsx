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
import { useBrandColors } from '@/contexts/BrandContext';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import { Swipeable } from 'react-native-gesture-handler';
import PostponeModal from '@/components/PostponeModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CALENDAR_BOX_MARGIN = 24;
const CALENDAR_BOX_PADDING = 24;
const PAGE_WIDTH = SCREEN_WIDTH - (CALENDAR_BOX_MARGIN * 2) - (CALENDAR_BOX_PADDING * 2);

interface AnimatedDayButtonProps {
    item: Date;
    isSelected: boolean;
    isToday: boolean;
    hasSessions: boolean;
    isOtherMonth: boolean;
    onPress: () => void;
}

const AnimatedDayButton = React.memo(({ item, isSelected, isToday, hasSessions, isOtherMonth, onPress }: AnimatedDayButtonProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
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
            className="items-center justify-center flex-1 py-1"
        >
            <Animated.View 
                style={[{ transform: [{ scale: scaleAnim }] }]}
                className={`w-9 h-9 rounded-full items-center justify-center ${isSelected ? 'bg-blue-600 shadow-xl shadow-blue-500/50' : ''}`}
            >
                <Text className={`text-base font-black ${isSelected ? 'text-white' : isOtherMonth ? 'text-slate-800' : isToday ? 'text-blue-500' : 'text-slate-400'}`}>
                    {item.getDate()}
                </Text>
                {hasSessions && (
                    <View className={`absolute -bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`} />
                )}
            </Animated.View>
        </Pressable>
    );
}, (prevProps, nextProps) => {
    return prevProps.isSelected === nextProps.isSelected &&
           prevProps.isToday === nextProps.isToday &&
           prevProps.hasSessions === nextProps.hasSessions &&
           prevProps.isOtherMonth === nextProps.isOtherMonth &&
           prevProps.item.toDateString() === nextProps.item.toDateString();
});

AnimatedDayButton.displayName = 'AnimatedDayButton';

interface AnimatedSessionCardProps {
    session: any;
    onPress: () => void;
    onLongPress?: () => void;
}

const AnimatedSessionCard = React.memo(({ session, onPress, onLongPress }: AnimatedSessionCardProps) => {
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
                    style={[{ transform: [{ scale: scaleAnim }] }]}
                    className={`border rounded-[36px] p-6 flex-row items-center ${
                        isPostponed
                            ? 'bg-yellow-950/15 border-yellow-500/20'
                            : isCancelled 
                                ? 'bg-red-950/15 border-red-500/20' 
                                : pressed 
                                    ? 'bg-slate-900/60 border-white/5' 
                                    : 'bg-slate-900/40 border-white/5'
                    }`}
                >
                    {/* Left: Time */}
                    <View className="items-center mr-4 w-16">
                        <Text className={`font-black text-lg ${isPostponed || isCancelled ? 'text-white' : 'text-blue-500'}`}>
                            {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text className={`font-black text-[10px] uppercase ${isPostponed || isCancelled ? 'text-slate-400' : 'text-blue-400/60'}`}>
                            {new Date(session.scheduled_at).getHours() >= 12 ? 'PM' : 'AM'}
                        </Text>
                    </View>

                    {/* Vertical Line */}
                    <View className={`w-[2px] h-12 rounded-full mr-6 ${isPostponed ? 'bg-yellow-500/20' : isCancelled ? 'bg-red-500/20' : 'bg-blue-600/30'}`} />

                    {/* Middle: Info */}
                    <View className="flex-1">
                        <Text className="font-black text-lg tracking-tight leading-tight mb-1 text-white">
                            {session.session_type === 'video' ? 'Performance Video Call' : 'Strategic Coaching'}
                        </Text>
                        <Text className="font-bold text-xs text-slate-500">
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
  const { primary, secondary } = useBrandColors();
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
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
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
  };

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(s => {
      const sd = new Date(s.scheduled_at);
      return sd.getDate() === date.getDate() && sd.getMonth() === date.getMonth() && sd.getFullYear() === date.getFullYear();
    });
  };

  const getDaysForPage = (pageIndex: number) => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      const day = d.getDay();
      const diff = (day === 0 ? 6 : day - 1);
      d.setDate(d.getDate() - diff + (pageIndex * 14) + i);
      return d;
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const pageIndex = viewableItems[0].item;
      const pageDays = getDaysForPage(pageIndex);
      // Update the month based on the first day of the visible 2-week block
      setViewingMonth(pageDays[0]);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  if (loading && !refreshing) return <View className="flex-1 bg-slate-950 items-center justify-center"><ActivityIndicator color={primary} /></View>;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <View className="px-6 pt-10 pb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-4xl font-black tracking-tight mb-2">
                    {viewingMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                {/* Date picker trigger */}
                <Pressable
                  onPressIn={() => handlePressIn(calendarBtnScale)}
                  onPressOut={() => handlePressOut(calendarBtnScale)}
                  onPress={() => setShowDatePicker(true)}
                >
                  {({ pressed }) => (
                      <Animated.View 
                          style={[{ transform: [{ scale: calendarBtnScale }] }]}
                          className={`w-10 h-10 rounded-2xl items-center justify-center border ${pressed ? 'bg-slate-700/80 border-white/10' : 'bg-slate-800/60 border-white/8'} mb-2`}
                      >
                          <CalendarDays size={18} color="#60A5FA" />
                      </Animated.View>
                  )}
                </Pressable>
              </View>
              <Text className="text-slate-400 font-medium">
                  You have {getSessionsForDate(selectedDate).length} sessions scheduled for today.
              </Text>
          </View>
          <View className="px-8 flex-row justify-end mb-2 opacity-40">
              <View className="flex-row items-center gap-1">
                  <ChevronsLeftRight size={14} color="#64748B" />
                  <Text className="text-slate-500 text-[10px] font-black uppercase">Swipe</Text>
              </View>
          </View>
          {/* Calendar Box */}
          <View className="bg-slate-900/30 rounded-[48px] p-6 mx-6 my-4 border border-white/5">
              <View className="flex-row justify-between mb-6 px-2">
                  <View className="flex-row flex-1 justify-between">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                        <View key={i} className="flex-1 items-center">
                            <Text className="text-slate-500 text-[9px] font-black">{day}</Text>
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
                  renderItem={({ item: pageIndex }) => {
                      const pageDays = getDaysForPage(pageIndex);
                      const week1 = pageDays.slice(0, 7);
                      const week2 = pageDays.slice(7, 14);
 
                      const renderDay = (item: Date) => {
                          const isS = item.toDateString() === selectedDate.toDateString();
                          const isToday = item.toDateString() === new Date().toDateString();
                          const has = getSessionsForDate(item).length > 0;
                          const isOtherMonth = item.getMonth() !== viewingMonth.getMonth();
                          return (
                              <AnimatedDayButton
                                  key={item.toISOString()}
                                  item={item}
                                  isSelected={isS}
                                  isToday={isToday}
                                  hasSessions={has}
                                  isOtherMonth={isOtherMonth}
                                  onPress={() => {
                                      closeAllSwipes();
                                      setSelectedDate(item);
                                  }}
                              />
                          );
                      };

                      return (
                          <View style={{ width: PAGE_WIDTH }}>
                              <View className="flex-row mb-4">
                                  {week1.map(renderDay)}
                              </View>
                              <View className="flex-row">
                                  {week2.map(renderDay)}
                              </View>
                          </View>
                      );
                  }}
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
                  <Text className="text-white text-2xl font-black tracking-tight">Today's Focus</Text>
              </View>

              <View className="space-y-4">
                  {getSessionsForDate(selectedDate).length === 0 ? (
                      <View className="p-16 items-center justify-center bg-slate-900/20 rounded-[48px] border border-white/5 border-dashed">
                          <View className="w-20 h-20 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5 mb-6">
                              <CalendarIcon size={32} color="#1E293B" />
                          </View>
                          <Text className="text-slate-700 font-black text-xs uppercase tracking-widest text-center">Day Clear</Text>
                          <Text className="text-slate-800 font-medium text-[10px] mt-2 text-center px-6 leading-5">You have no live coaching sessions scheduled for this date.</Text>
                      </View>
                  ) : (
                      getSessionsForDate(selectedDate).map((session, idx) => {
                          const isPostponed = session.status === 'postponed' || (session.status === 'cancelled' && session.cancellation_reason?.toLowerCase().includes('postpone'));
                          const isCancelled = session.status === 'cancelled' && !isPostponed;
                          return (
                              <MotiView key={session.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: idx * 50 }} className="mb-4">
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
                              </MotiView>
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
                       style={[{ transform: [{ scale: plusBtnScale }] }]}
                       className={`w-16 h-16 rounded-full items-center justify-center shadow-2xl border border-white/10 ${pressed ? 'bg-blue-700 shadow-blue-500/30' : 'bg-blue-600 shadow-blue-500/50'}`}
                   >
                       <Plus size={32} color="white" />
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
          {showDatePicker && (
            <DatePickerOverlay
              visible={showDatePicker}
              selectedDate={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setViewingMonth(date);
                setTimeout(() => {
                  scrollToDate(date);
                }, 50);
              }}
              onClose={() => setShowDatePicker(false)}
            />
          )}

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
                    className="bg-slate-900 rounded-t-[48px] p-8 border-t border-white/10"
                  >
                      <View className="w-12 h-1.5 bg-slate-800 rounded-full self-center mb-8" />
                      <Text className="text-white text-2xl font-black mb-6 tracking-tight">Session Actions</Text>
                      
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
                        <Text className="text-slate-500 italic text-center p-4">No actions available for this session</Text>
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
const OptionItem = ({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) => (
    <Pressable 
        onPress={onPress} 
        className="flex-row items-center p-4 bg-slate-800/40 rounded-3xl border border-white/5 mb-4 active:bg-slate-800/80"
    >
        <View className="w-10 h-10 rounded-2xl items-center justify-center bg-slate-900 border border-white/5 mr-4">
            {icon}
        </View>
        <View className="flex-1">
            <Text className="text-white font-bold text-base">{title}</Text>
            <Text className="text-slate-500 text-xs mt-0.5">{sub}</Text>
        </View>
        <ChevronRight size={16} color="#64748B" />
    </Pressable>
);
