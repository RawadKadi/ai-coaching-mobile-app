import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  LayoutAnimation,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Plus, Calendar as CalendarIcon, Clock, ChevronRight, Check, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import CoachSubpageHeader from '@/components/CoachSubpageHeader';
import * as Haptics from 'expo-haptics';
import SchedulerModal from '@/components/SchedulerModal';
import GoogleMeetGateModal from '@/components/GoogleMeetGateModal';
import { googleMeetService } from '@/lib/google-meet-service';
import PendingResolutionsModal from '@/components/PendingResolutionsModal';
import ConflictResolutionModal from '@/components/ConflictResolutionModal';

export default function CoachClientSessionsScreen() {
  const { clientId, name, avatar } = useLocalSearchParams<{ clientId: string; name?: string; avatar?: string }>();
  const id = clientId;
  const { coach, user } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const reduceMotion = useReducedMotion();
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text;
  const textSecondaryColor = colors.textSecondary;
  const cardBg = colors.surface;
  const cardBorder = colors.border;

  const [client, setClient] = useState<any>(null);
  const [sessionLog, setSessionLog] = useState<any[]>([]);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [pendingResolutions, setPendingResolutions] = useState<any[]>([]);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [showGoogleMeetGate, setShowGoogleMeetGate] = useState(false);
  const [isMeetConnected, setIsMeetConnected] = useState(() => googleMeetService.isConnectedSync(coach));
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<any>(null);
  const [pastSessionsExpanded, setPastSessionsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  const loadData = useCallback(async () => {
    if (!coach?.id || !id) return;
    try {
      const [clientRes, coachSessionsRes, logRes] = await Promise.all([
        supabase.rpc('get_client_details', { target_client_id: id }),
        supabase
          .from('sessions')
          .select('*, client:clients!sessions_client_id_fkey(id, profiles(full_name))')
          .eq('coach_id', coach.id)
          .gte('scheduled_at', new Date().toISOString()),
        supabase
          .from('sessions')
          .select('*')
          .eq('client_id', id)
          .order('scheduled_at', { ascending: false }),
      ]);

      if (clientRes.data) setClient(clientRes.data);
      if (logRes.data) setSessionLog(logRes.data);

      const rows = coachSessionsRes.data || [];
      setAllCoachSessions(
        rows.map((s: any) => ({ ...s, client_name: s.client?.profiles?.full_name || 'Unknown' })),
      );
      setPendingResolutions(
        rows.filter(
          (s: any) =>
            s.client_id === id &&
            (s.status === 'pending_resolution' ||
              s.status === 'proposed' ||
              (s.invite_sent === true && s.status === 'scheduled' && !s.cancellation_reason) ||
              s.cancellation_reason?.startsWith('pending_reschedule') ||
              s.cancellation_reason === 'reschedule_rejected'),
        ),
      );
      hasLoaded.current = true;
    } finally {
      setRefreshing(false);
    }
  }, [coach?.id, id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const loadClientData = loadData;
  const clientName = (name as string) || client?.profiles?.full_name || 'Client';

                  // Compute Weekly Slots and Ad-Hoc/Past Sessions
                  const activeWeeklySlots = sessionLog.filter(s => s.recurrence_rule && s.recurrence_rule.includes('WEEKLY'));
                  const weeklySlotConfigs = activeWeeklySlots.map(s => {
                    const d = new Date(s.scheduled_at);
                    return {
                      dayOfWeek: d.getDay(),
                      hour: d.getHours(),
                      minute: d.getMinutes(),
                      sessionType: s.session_type,
                      duration: s.duration_minutes || 60,
                      session: s
                    };
                  });

                  const upcomingSessions = sessionLog.filter(s => {
                    return s.status === 'scheduled' && new Date(s.scheduled_at) > new Date();
                  });

                  const upcomingWeeklyOccurrences: any[] = [];
                  const upcomingAdHocSessions: any[] = [];

                  upcomingSessions.forEach(s => {
                    const d = new Date(s.scheduled_at);
                    const isWeeklyOccurrence = weeklySlotConfigs.some(cfg => {
                      const dayMatches = d.getDay() === cfg.dayOfWeek;
                      const timeDiffMin = Math.abs((d.getHours() * 60 + d.getMinutes()) - (cfg.hour * 60 + cfg.minute));
                      return dayMatches && timeDiffMin <= 30;
                    });
                    
                    if (isWeeklyOccurrence) {
                      upcomingWeeklyOccurrences.push(s);
                    } else {
                      upcomingAdHocSessions.push(s);
                    }
                  });

                  const pastSessions = sessionLog.filter(s => {
                    const isPast = new Date(s.scheduled_at) <= new Date();
                    const isCompletedOrCancelled = s.status === 'completed' || s.status === 'cancelled';
                    return isPast || isCompletedOrCancelled;
                  });

                  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                  const weeklyCadence = daysOfWeek.map((dayName, idx) => {
                    const targetDayOfWeek = idx === 6 ? 0 : idx + 1; // 0 for Sunday, 1 for Monday, etc.
                    const slotCfg = weeklySlotConfigs.find(cfg => cfg.dayOfWeek === targetDayOfWeek);
                    
                    if (slotCfg) {
                      const conflictingSession = upcomingAdHocSessions.find(s => {
                        const d = new Date(s.scheduled_at);
                        return d.getDay() === targetDayOfWeek;
                      });
                      
                      return {
                        day: dayName,
                        status: conflictingSession ? 'Rescheduled' : 'Active',
                        is_active: true,
                        session: slotCfg.session,
                        rescheduled: conflictingSession ? {
                          date: new Date(conflictingSession.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                          time: new Date(conflictingSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          session: conflictingSession
                        } : null
                      };
                    }
                    
                    return {
                      day: dayName,
                      status: 'Not Set',
                      is_active: false
                    };
                  });


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <CoachSubpageHeader
        title="Sessions"
        subtitle={clientName}
        clientName={clientName}
        avatarUrl={avatar || client?.profiles?.avatar_url}
      />

      {pendingResolutions.length > 0 && (
        <TouchableOpacity
          style={{ backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }}
          className="mx-3 mt-3 border rounded-2xl p-4 flex-row items-center justify-between"
          onPress={() => setPendingModalVisible(true)}
        >
          <View className="flex-row items-center gap-3">
            <View style={{ backgroundColor: colors.primary }} className="w-2 h-2 rounded-full" />
            <Text style={{ color: colors.primary }} className="font-bold text-xs uppercase tracking-widest">
              {pendingResolutions.length} Resolutions Pending
            </Text>
          </View>
          <ChevronRight size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 64 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary}
          />
        }
      >
                    <View className="px-3 pt-3">
                      {/* Action Button */}
                      <TouchableOpacity 
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          if (!isMeetConnected && !googleMeetService.isConnectedSync(coach)) {
                            setShowGoogleMeetGate(true);
                            return;
                          }
                          setSchedulerVisible(true);
                        }}
                        className="mb-6 h-14 rounded-2xl flex-row items-center justify-center gap-2"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Plus size={18} color={colors.textOnPrimary || 'white'} strokeWidth={3} />
                        <Text className="font-bold text-xs uppercase tracking-wider" style={{ color: colors.textOnPrimary || 'white' }}>Schedule Session</Text>
                      </TouchableOpacity>

                      {/* Primary Focus: Weekly Cadence */}
                      <View className="mb-6">
                        <View className="flex-row items-center justify-between mb-3 px-1">
                          <View>
                            <Text className="text-2xl font-black tracking-tight" style={{ color: textColor }}>Weekly Slots</Text>
                            <Text className="text-xs mt-0.5" style={{ color: textSecondaryColor }}>Regular weekly session times</Text>
                          </View>
                          <View 
                            className="w-9 h-9 rounded-xl border items-center justify-center"
                            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                          >
                            <CalendarIcon size={16} color={colors.primary} />
                          </View>
                        </View>
                        
                        <View className="gap-2.5">
                          {weeklyCadence.map((dayItem, idx) => (
                            <MotiView
                              key={dayItem.day}
                              from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                              transition={{ delay: idx * 30 }}
                              className="rounded-[28px] p-4 border flex-row items-center justify-between"
                              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                            >
                              <View className="flex-1">
                                <Text className="font-black text-base" style={{ color: textColor }}>{dayItem.day}</Text>
                                {dayItem.is_active ? (
                                  dayItem.status === 'Rescheduled' && dayItem.rescheduled ? (
                                    <View className="mt-1 gap-0.5">
                                      <Text className="font-medium text-xs" style={{ color: textSecondaryColor }}>
                                        {dayItem.session.session_type.replace('_', ' ')} · {new Date(dayItem.session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                      <Text className="text-amber-500 font-bold text-xs">
                                        Moved to {dayItem.rescheduled.date} at {dayItem.rescheduled.time}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text className="font-medium text-xs mt-0.5" style={{ color: textSecondaryColor }}>
                                      {dayItem.session.session_type.replace('_', ' ')} · {new Date(dayItem.session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                  )
                                ) : (
                                  <Text className="font-medium text-xs mt-0.5" style={{ color: textSecondaryColor }}>Not scheduled</Text>
                                )}
                              </View>
                              
                              <View>
                                {dayItem.is_active ? (
                                  dayItem.status === 'Rescheduled' ? (
                                    <View 
                                      className="px-2.5 py-1 rounded-full border"
                                      style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                    >
                                      <Text style={{ color: colors.primary }} className="font-black text-[9px] uppercase tracking-wider">Rescheduled</Text>
                                    </View>
                                  ) : (
                                    <View 
                                      className="px-2.5 py-1 rounded-full border"
                                      style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                    >
                                      <Text style={{ color: colors.primary }} className="font-black text-[9px] uppercase tracking-wider">Set</Text>
                                    </View>
                                  )
                                ) : (
                                  <View 
                                    className="px-2.5 py-1 rounded-full border"
                                    style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                                  >
                                    <Text className="font-black text-[9px] uppercase tracking-wider" style={{ color: textSecondaryColor }}>Not Set</Text>
                                  </View>
                                )}
                              </View>
                            </MotiView>
                          ))}
                        </View>
                      </View>

                      {/* Secondary Focus: Upcoming Ad-Hoc */}
                      <View className="mb-6">
                        <View className="flex-row items-center justify-between mb-3 px-1">
                          <View>
                            <Text className="text-2xl font-black tracking-tight" style={{ color: textColor }}>Extra Sessions</Text>
                            <Text className="text-xs mt-0.5" style={{ color: textSecondaryColor }}>One-time meetings</Text>
                          </View>
                          <View 
                            className="w-9 h-9 rounded-xl border items-center justify-center"
                            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                          >
                            <Plus size={16} color={colors.primary} />
                          </View>
                        </View>
                        
                        {upcomingAdHocSessions.length === 0 ? (
                          <View 
                            className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                          >
                            <Text className="font-bold text-xs uppercase" style={{ color: textSecondaryColor }}>No extra sessions</Text>
                            <Text className="text-xs mt-1 text-center" style={{ color: textSecondaryColor }}>Only weekly slots are active.</Text>
                          </View>
                        ) : (
                          <View className="gap-2.5">
                            {upcomingAdHocSessions.map((session, idx) => (
                              <MotiView
                                key={session.id}
                                from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                transition={{ delay: idx * 30 }}
                                className="rounded-[28px] p-4 border flex-row items-center justify-between"
                                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                              >
                                <View className="flex-1">
                                  <View className="flex-row items-center gap-2 mb-1">
                                    <CalendarIcon size={12} color={colors.primary} />
                                    <Text className="font-black text-sm" style={{ color: textColor }}>
                                      {new Date(session.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </Text>
                                  </View>
                                  <View className="flex-row items-center gap-3">
                                    <View className="flex-row items-center gap-1.5">
                                      <Clock size={12} color={textSecondaryColor} />
                                      <Text className="font-bold text-xs" style={{ color: textSecondaryColor }}>
                                        {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                    </View>
                                    <View className="w-1 h-1 rounded-full" style={{ backgroundColor: cardBorder }} />
                                    <Text className="font-bold text-xs" style={{ color: textSecondaryColor }}>{session.duration_minutes || 60} min</Text>
                                    <View className="w-1 h-1 rounded-full" style={{ backgroundColor: cardBorder }} />
                                    <Text className="font-bold text-xs capitalize" style={{ color: textSecondaryColor }}>{session.session_type.replace('_', ' ')}</Text>
                                  </View>
                                </View>
                                
                                <View 
                                  className="px-2.5 py-1 rounded-full border"
                                  style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                >
                                  <Text className="font-black text-[9px] uppercase tracking-wider" style={{ color: colors.primary }}>Upcoming</Text>
                                </View>
                              </MotiView>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Tertiary Focus: History */}
                      <View className="mb-6">
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setPastSessionsExpanded(!pastSessionsExpanded);
                          }}
                          className="flex-row items-center justify-between p-4 rounded-[28px] border"
                          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                        >
                          <View className="flex-row items-center gap-3">
                            <Clock size={16} color={colors.primary} />
                            <Text className="font-black text-sm uppercase tracking-wider" style={{ color: textSecondaryColor }}>Past Sessions ({pastSessions.length})</Text>
                          </View>
                          <MotiView
                            from={{ rotate: '0deg' }}
                            animate={{ rotate: pastSessionsExpanded ? '90deg' : '0deg' }}
                            transition={{ type: 'timing', duration: 200 } as any}
                          >
                            <ChevronRight size={18} color={textSecondaryColor} />
                          </MotiView>
                        </TouchableOpacity>
                        
                        {pastSessionsExpanded && (
                          <View className="mt-2.5 gap-2.5">
                            {pastSessions.length === 0 ? (
                              <View 
                                className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                              >
                                <Text className="font-bold text-xs uppercase" style={{ color: textSecondaryColor }}>No past sessions</Text>
                              </View>
                            ) : (
                              pastSessions.map((session, idx) => (
                                <MotiView
                                  key={session.id}
                                  from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                  transition={{ delay: idx * 20 }}
                                  className="rounded-[28px] p-4 border flex-row items-center justify-between"
                                  style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                                >
                                  <View className="flex-1">
                                    <View className="flex-row items-center gap-2 mb-1">
                                      <CalendarIcon size={12} color={colors.primary} />
                                      <Text className="font-black text-sm" style={{ color: textColor }}>
                                        {new Date(session.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                      </Text>
                                    </View>
                                    <View className="flex-row items-center gap-3">
                                      <View className="flex-row items-center gap-1.5">
                                        <Clock size={12} color={textSecondaryColor} />
                                        <Text className="font-bold text-xs" style={{ color: textSecondaryColor }}>
                                          {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                      </View>
                                      <View className="w-1 h-1 rounded-full" style={{ backgroundColor: cardBorder }} />
                                      <Text className="font-bold text-xs" style={{ color: textSecondaryColor }}>{session.duration_minutes || 60} min</Text>
                                      <View className="w-1 h-1 rounded-full" style={{ backgroundColor: cardBorder }} />
                                      <Text className="font-bold text-xs capitalize" style={{ color: textSecondaryColor }}>{session.session_type.replace('_', ' ')}</Text>
                                    </View>
                                  </View>
                                  
                                  {(() => {
                                    const isCompleted = session.status === 'completed';
                                    const isMissed = (session.status === 'scheduled' && new Date(session.scheduled_at) <= new Date()) || (session.status === 'cancelled' && session.cancellation_reason === 'Client No-Show');
                                    const isDiscussed = session.status === 'cancelled' && session.cancellation_reason !== 'Client No-Show';
                                    
                                    if (isCompleted) {
                                      return (
                                        <View 
                                          className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                                          style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                        >
                                          <Check size={10} color={colors.primary} strokeWidth={3} />
                                          <Text style={{ color: colors.primary }} className="font-black text-[9px] uppercase tracking-wider">Completed</Text>
                                        </View>
                                      );
                                    }
                                    if (isMissed) {
                                      return (
                                        <View 
                                          className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                                          style={{ backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }}
                                        >
                                          <X size={10} color={colors.primary} strokeWidth={3} />
                                          <Text style={{ color: colors.primary }} className="font-black text-[9px] uppercase tracking-wider">Missed</Text>
                                        </View>
                                      );
                                    }
                                    if (isDiscussed) {
                                      return (
                                        <View 
                                          className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                                          style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                                        >
                                          <Text className="font-black text-[9px] uppercase tracking-wider" style={{ color: textSecondaryColor }}>Discussed</Text>
                                        </View>
                                      );
                                    }
                                    return (
                                      <View 
                                        className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                                        style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                                      >
                                        <Text className="font-black text-[9px] uppercase tracking-wider capitalize" style={{ color: textSecondaryColor }}>{session.status}</Text>
                                      </View>
                                    );
                                  })()}
                                </MotiView>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    </View>
      </ScrollView>

      {client && (
        <SchedulerModal
          visible={schedulerVisible}
          onClose={() => setSchedulerVisible(false)}
          onConfirm={async () => {
            await loadClientData();
          }}
          clientContext={{
            name: client.profiles?.full_name || 'Client',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            avatar_url: client.profiles?.avatar_url,
          }}
          existingSessions={allCoachSessions}
          targetClientId={id as string}
        />
      )}

      <GoogleMeetGateModal
        visible={showGoogleMeetGate}
        coachId={coach?.id}
        expectedEmail={user?.email}
        onClose={() => setShowGoogleMeetGate(false)}
        onConnected={() => {
          setShowGoogleMeetGate(false);
          setSchedulerVisible(true);
        }}
      />

      <PendingResolutionsModal
        visible={pendingModalVisible}
        onClose={() => {
          setPendingModalVisible(false);
          loadClientData();
        }}
        sessions={pendingResolutions}
        onResolve={(session) => {
          setPendingModalVisible(false);
          const proposedStart = new Date(session.scheduled_at).getTime();
          const proposedEnd = proposedStart + (session.duration_minutes || 60) * 60000;
          const existing = allCoachSessions.find(
            (s) =>
              s.id !== session.id &&
              s.status !== 'cancelled' &&
              new Date(s.scheduled_at).getTime() < proposedEnd &&
              new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60000 > proposedStart,
          );
          if (existing) {
            setCurrentConflict({
              existingSession: { ...existing, client_name: existing.client_name },
              proposedSession: { ...session, client_name: clientName },
              recommendations: [],
            });
            setConflictModalVisible(true);
          } else {
            Alert.alert('No Conflict', 'Confirm this session?', [
              { text: 'Cancel' },
              {
                text: 'Confirm',
                onPress: async () => {
                  await supabase.from('sessions').update({ status: 'scheduled' }).eq('id', session.id);
                  loadClientData();
                },
              },
            ]);
          }
        }}
        onDelete={async (s) => {
          await supabase.from('sessions').delete().eq('id', s.id);
          loadClientData();
        }}
      />

      {currentConflict && (
        <ConflictResolutionModal
          visible={conflictModalVisible}
          conflictInfo={currentConflict}
          onCancel={() => {
            setConflictModalVisible(false);
            setCurrentConflict(null);
          }}
          onResolve={async () => {
            await loadClientData();
            setConflictModalVisible(false);
            setCurrentConflict(null);
          }}
        />
      )}
    </View>
  );
}
