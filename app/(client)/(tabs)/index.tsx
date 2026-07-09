import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl, Alert, Animated as RNAnimated, Easing } from 'react-native';
import StrandsBackground from '@/components/ui/StrandsBackground';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { 
  Calendar, 
  TrendingUp, 
  Target, 
  Heart, 
  Camera, 
  ChevronRight, 
  Zap, 
  Brain, 
  Sparkles,
  ClipboardCheck,
  Award,
  CheckCircle2,
  Utensils,
  Activity,
  Video,
  Clock
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog } from '@/types/database';
import { formatCompactNumber } from '@/lib/format-utils';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isHealthSyncAvailable, requestHealthPermissions, getTodaySteps } from '@/lib/health-service';
import { FirstTimeHeroCards } from '@/components/client/FirstTimeHeroCards';
import { GlassNavbar } from '@/components/GlassNavbar';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';

export default function ClientDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, client, loading: authLoading } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);
  
  // Custom synced activity and metrics states
  const [todayCalories, setTodayCalories] = useState<number>(0);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [weightDaysAgo, setWeightDaysAgo] = useState<number>(0);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [stepsSyncEnabled, setStepsSyncEnabled] = useState<boolean>(false);

  // Upcoming session state
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Tick nowMs every 30s so the Join button re-evaluates without a full reload
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(ticker);
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (client) loadDashboardData();
      else if (!authLoading) setLoading(false);
    }, [client, authLoading])
  );

  // Real-time subscription for dashboard updates (check-ins, habits, logs)
  useEffect(() => {
    if (!client) return;
    
    const today = new Date().toISOString().split('T')[0];
    const channel = supabase.channel('client_dashboard_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'check_ins',
          filter: `client_id=eq.${client.id}`
        },
        (payload) => {
          // If the payload date is today, update the todayCheckIn state
          if (payload.new && payload.new.date === today) {
            setTodayCheckIn(payload.new as CheckIn);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_logs',
          filter: `client_id=eq.${client.id}`
        },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `client_id=eq.${client.id}`
        },
        () => loadDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client]);

  const loadDashboardData = async () => {
    if (!client) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch sync status from local storage
      const syncEnabledStr = await AsyncStorage.getItem('@steps_sync_enabled');
      const isSyncEnabled = syncEnabledStr === 'true';
      setStepsSyncEnabled(isSyncEnabled);

      // Fetch next upcoming session for this client
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*, coaches(profiles(full_name, avatar_url))')
        .eq('client_id', client.id)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Only surface it if it's today
      if (sessionData) {
        const sessionDate = new Date(sessionData.scheduled_at).toDateString();
        const todayStr = new Date().toDateString();
        setUpcomingSession(sessionDate === todayStr ? sessionData : null);
      } else {
        setUpcomingSession(null);
      }

      const [checkInResult, habitsResult, habitLogsResult, mealsResult, dailyLogResult] = await Promise.all([
        supabase.from('check_ins').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
        supabase.from('habits').select('*').eq('client_id', client.id).eq('is_active', true),
        supabase.from('habit_logs').select('*').eq('client_id', client.id).eq('date', today),
        supabase.from('meals').select('calories').eq('client_id', client.id).eq('meal_date', today),
        supabase.from('daily_logs').select('steps').eq('client_id', client.id).eq('date', today).maybeSingle(),
      ]);
      
      let checkIn = checkInResult.data;

      // Calculate Calories Eaten Today
      const mealsData = mealsResult.data || [];
      const totalCalories = mealsData.reduce((sum, meal) => sum + (meal.calories || 0), 0);
      setTodayCalories(totalCalories);

      // Fetch Latest Check-In weight with non-null value (even if from a past date)
      const { data: latestWeightData } = await supabase
        .from('check_ins')
        .select('weight_kg, date')
        .eq('client_id', client.id)
        .not('weight_kg', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestWeightData?.weight_kg) {
        setLatestWeight(Number(latestWeightData.weight_kg));
        const checkInDate = new Date(latestWeightData.date);
        const todayDate = new Date(today);
        const diffTime = Math.abs(todayDate.getTime() - checkInDate.getTime());
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setWeightDaysAgo(days);
      } else {
        setLatestWeight(null);
        setWeightDaysAgo(0);
      }

      // Auto-Sync Steps Tracker
      let syncedSteps: number | null = null;
      if (isSyncEnabled) {
        const localStepsKey = `@steps_${today}`;
        const storedSteps = await AsyncStorage.getItem(localStepsKey);
        
        let stepsToSync = storedSteps ? parseInt(storedSteps) : 0;

        if (await isHealthSyncAvailable()) {
          const realSteps = await getTodaySteps();
          if (realSteps !== null) {
            stepsToSync = realSteps;
            await AsyncStorage.setItem(localStepsKey, stepsToSync.toString());
            try {
              await supabase.from('daily_logs').upsert({
                client_id: client.id,
                date: today,
                steps: stepsToSync
              }, { onConflict: 'client_id,date' });
            } catch (dbErr) {
              console.warn('Upserting steps failed:', dbErr);
            }
          }
        }
        syncedSteps = stepsToSync;
      } else if (dailyLogResult.data) {
        syncedSteps = dailyLogResult.data.steps;
      }
      setTodaySteps(syncedSteps);

      setTodayCheckIn(checkIn);
      setHabits(habitsResult.data || []);
      setTodayHabitLogs(habitLogsResult.data || []);
    } catch (e) { console.error('Dashboard load error:', e); } finally { setLoading(false); setRefreshing(false); }
  };

  const handleStepsSyncPress = async () => {
    if (stepsSyncEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Perform active real sync when user requests it
      const realSteps = await getTodaySteps();
      if (realSteps !== null) {
        const today = new Date().toISOString().split('T')[0];
        const localStepsKey = `@steps_${today}`;
        await AsyncStorage.setItem(localStepsKey, realSteps.toString());
        
        if (client?.id) {
          try {
            await supabase.from('daily_logs').upsert({
              client_id: client.id,
              date: today,
              steps: realSteps
            }, { onConflict: 'client_id,date' });
          } catch (dbErr) {
            console.warn('Upserting steps failed:', dbErr);
          }
        }
        
        setTodaySteps(realSteps);
        
        Alert.alert(
          "Steps Synced",
          `Today: ${realSteps.toLocaleString()} steps.`,
          [{ text: "Ok" }]
        );
      } else {
        Alert.alert(
          "Sync Failed",
          "Cannot read steps. Please check your Health app settings.",
          [{ text: "Ok" }]
        );
      }
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Share Steps?",
      "Let this app sync steps from your health app to share progress with your coach?",
      [
        { text: "Not Now", style: "cancel" },
        { 
          text: "Share Steps", 
          onPress: async () => {
            try {
              const hasPermission = await requestHealthPermissions();
              if (!hasPermission) {
                Alert.alert(
                  "Permission Required",
                  "Enable permissions in your Health settings to sync steps.",
                  [{ text: "Ok" }]
                );
                return;
              }

              await AsyncStorage.setItem('@steps_sync_enabled', 'true');
              setStepsSyncEnabled(true);
              
              const today = new Date().toISOString().split('T')[0];
              const localStepsKey = `@steps_${today}`;
              const realSteps = await getTodaySteps();
              const stepsToSync = realSteps !== null ? realSteps : 0;
              
              await AsyncStorage.setItem(localStepsKey, stepsToSync.toString());

              if (client?.id && stepsToSync > 0) {
                await supabase.from('daily_logs').upsert({
                  client_id: client.id,
                  date: today,
                  steps: stepsToSync
                }, { onConflict: 'client_id,date' });
              }

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Connected!", "Your steps are now sharing automatically.");
              loadDashboardData();
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]
    );
  };

  const onRefresh = () => { setRefreshing(true); loadDashboardData(); };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const completedHabitsCount = todayHabitLogs.filter(log => log.completed).length;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" progressViewOffset={insets.top + 60} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
          {/* Refined Client Header (Now scrolls under the glass navbar) */}
          <MotiView 
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              className="px-6 pb-6 flex-row items-center justify-between"
          >
              <View>
                  <Text className="text-white text-3xl font-black tracking-tighter">Good morning,</Text>
                  <Text className="text-blue-500 text-3xl font-black tracking-tighter">{profile?.full_name?.split(' ')[0]}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(client)/(tabs)/profile')}
                className="p-1.5 bg-slate-900 rounded-[24px] border border-white/5 shadow-2xl"
              >
                <BrandedAvatar size={60} name={profile?.full_name || 'U'} imageUrl={profile?.avatar_url} />
                <View className="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900" />
              </TouchableOpacity>
          </MotiView>

          <View className="px-3">
            {/* First Time Hero Cards */}
            <FirstTimeHeroCards clientName={profile?.full_name?.split(' ')[0] || ''} />

            {/* Status Grid */}
            <View className="flex-row flex-wrap justify-between gap-4 mb-4">
                <MetricCard 
                  label="Calories" 
                  value={todayCalories > 0 ? `${todayCalories} kcal` : '--'} 
                  icon={<Utensils size={20} color="#3B82F6" />} 
                  active={todayCalories > 0}
                  onPress={() => router.push('/(client)/activity')}
                />
                <MetricCard 
                  label="Daily Tasks" 
                  value={`${completedHabitsCount}/${habits.length}`} 
                  icon={<Award size={20} color="#10B981" />} 
                  active={completedHabitsCount === habits.length && habits.length > 0}
                />
                <MetricCard 
                  label={weightDaysAgo > 5 ? `Weight (${weightDaysAgo}d ago)` : "Weight"} 
                  value={latestWeight ? `${latestWeight}kg` : '--'} 
                  icon={<TrendingUp size={20} color={weightDaysAgo > 5 ? "#EF4444" : "#F59E0B"} />} 
                  active={!!latestWeight}
                  onPress={() => router.push('/(client)/check-in')}
                />
                <MetricCard 
                  label={stepsSyncEnabled ? "Steps" : "Sync Steps"} 
                  value={todaySteps !== null ? `${todaySteps.toLocaleString()}` : 'Click to Sync'} 
                  icon={<Activity size={20} color={stepsSyncEnabled ? "#3B82F6" : "#64748B"} />} 
                  active={stepsSyncEnabled}
                  onPress={handleStepsSyncPress}
                  showGlow={!stepsSyncEnabled}
                />
            </View>

            {/* Daily Call to Action / Status */}
            {!todayCheckIn ? (
                <CheckInCTACard onPress={() => router.push('/(client)/check-in')} />
            ) : !todayCheckIn.ai_analysis ? (
                <MotiView 
                  key="checkin-done"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 overflow-hidden rounded-[40px] bg-slate-900 border border-blue-500/20 shadow-2xl shadow-blue-500/10 relative"
                >
                  <View className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full" />
                  
                  <View className="p-8">
                      <View className="flex-row items-center gap-2 mb-3">
                        <View className="w-6 h-6 bg-blue-500/20 rounded-full items-center justify-center border border-blue-500/30">
                          <CheckCircle2 size={12} color="#3B82F6" />
                        </View>
                        <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[3px]">Plan Synced</Text>
                      </View>
                      
                      <Text className="text-white text-3xl font-black tracking-tight leading-8 mb-2">Metrics Logged</Text>
                      <Text className="text-slate-400 font-medium text-sm leading-6">Your data is securely stored. The AI and your coach are analyzing your progress.</Text>
                      
                      <View className="mt-8 flex-row items-center justify-between">
                          <MotiView
                              from={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 400 }}
                              className="flex-row items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20"
                          >
                              <ActivityIndicator size="small" color="#3B82F6" />
                              <Text className="text-blue-400 font-black text-[10px] uppercase tracking-widest">AI Processing</Text>
                          </MotiView>
                          
                          <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 items-center justify-center z-20">
                              <Brain size={14} color="#818CF8" />
                            </View>
                            <View className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 items-center justify-center z-10 -ml-2">
                              <Zap size={14} color="#F59E0B" />
                            </View>
                          </View>
                      </View>
                  </View>
                </MotiView>
            ) : null}

            {/* Coach's Insights */}
            {todayCheckIn?.ai_analysis && (
                <MotiView 
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  className="mt-10 p-8 rounded-[48px] bg-slate-900 border border-white/5 shadow-xl"
                >
                    <View className="flex-row items-center gap-4 mb-8">
                        <View className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-2xl items-center justify-center">
                            <Brain size={24} color="#3B82F6" />
                        </View>
                        <View>
                          <Text className="text-white font-black text-lg tracking-tight">Today's Strategy</Text>
                          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Feedback Loop</Text>
                        </View>
                    </View>
                    <Text className="text-slate-200 leading-7 font-medium text-lg">
                        {todayCheckIn.ai_analysis}
                    </Text>
                    <View className="mt-8 pt-8 border-t border-white/5 flex-row items-center gap-2">
                        <Sparkles size={16} color="#818CF8" />
                        <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[3px]">AI-Assisted Guidance</Text>
                    </View>
                </MotiView>
            )}

            {/* Quick Actions Grid */}
            <View className="mt-12">
                <Text className="text-white text-2xl font-black tracking-tighter mb-6 px-1">Quick Access</Text>

                {/* Upcoming Session Card — today only */}
                {upcomingSession && (
                  <UpcomingSessionCard
                    session={upcomingSession}
                    nowMs={nowMs}
                    onJoin={() => router.push('/(client)/chat' as any)}
                  />
                )}

                <View className="flex-row gap-4 mt-2">
                    <ActionCard 
                        label="Log Meal" 
                        sub="Photo Analysis"
                        icon={<Camera size={28} color="#3B82F6" />} 
                        onPress={() => router.push('/(client)/log-meal')}
                    />
                    <ActionCard 
                        label="Challenges" 
                        sub="Active Goals"
                        icon={<Award size={28} color="#10B981" />} 
                        onPress={() => router.push('/(client)/challenges')}
                    />
                </View>
            </View>
          </View>
        </ScrollView>

        <GlassNavbar title="Home" />
    </View>
  );
}

// ─── Check-In CTA Card ───────────────────────────────────────────────────────
// Wraps the "Complete Your Check-in" card and injects the native Strands
// animation as an absolute background layer, faded and using brand colours.
const CheckInCTACard = ({ onPress }: { onPress: () => void }) => {
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  return (
    <MotiView
      key="checkin-cta"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ marginTop: 24, borderRadius: 40, overflow: 'hidden' }}
      className="bg-blue-600 shadow-2xl shadow-blue-500/30 border border-white/10"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardSize({ width, height });
      }}
    >
      {/* Faded strands animation in the background */}
      <StrandsBackground
        width={cardSize.width}
        height={cardSize.height}
        opacity={0.28}
      />

      <TouchableOpacity className="p-8" onPress={onPress}>
        <View className="flex-row items-center gap-2 mb-3">
          <Zap size={14} color="white" />
          <Text className="text-white/80 text-[10px] font-black uppercase tracking-[3px]">Daily Goal</Text>
        </View>
        <Text className="text-white text-3xl font-black tracking-tight leading-8">Complete Your Check-in</Text>
        <Text className="text-white/80 mt-3 font-medium text-sm leading-6">Update your coach on your energy, weight, and meal progress today.</Text>
        <View className="mt-8 flex-row items-center justify-between">
          <View className="bg-white px-5 py-2.5 rounded-full">
            <Text className="text-blue-600 font-black text-xs uppercase tracking-widest">Start Now</Text>
          </View>
          <ChevronRight size={24} color="white" opacity={0.5} />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};

const MetricCard = ({ label, value, icon, active, onPress, showGlow = false }: any) => {
    const displayValue = typeof value === 'number' ? formatCompactNumber(value) : value;

    // Auto-pulsing glow: breathes between dim and bright
    const glowAnim = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        if (!showGlow) {
            glowAnim.setValue(0);
            return;
        }
        const pulse = RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(glowAnim, {
                    toValue: 1,
                    duration: 1800,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                RNAnimated.timing(glowAnim, {
                    toValue: 0,
                    duration: 1800,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [showGlow]);

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.08, 0.55],
    });

    return (
        <TouchableOpacity 
            onPress={onPress}
            disabled={!onPress}
            className={`w-[47%] p-6 rounded-[36px] border-2 transition-all shadow-lg overflow-hidden ${active ? 'bg-slate-900/50 border-white/10' : 'bg-slate-900/20 border-white/5 border-dashed'}`}
            style={{ position: 'relative' }}
        >
            {/* Auto-pulsing ambient glow when unsynced */}
            {showGlow && (
                <RNAnimated.View
                    style={{
                        position: 'absolute',
                        inset: 0,
                        top: 0, left: 0, right: 0, bottom: 0,
                        borderRadius: 36,
                        opacity: glowOpacity,
                        backgroundColor: '#3B82F6',
                        shadowColor: '#3B82F6',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 32,
                        elevation: 12,
                    }}
                    pointerEvents="none"
                />
            )}
            <View className="w-12 h-12 bg-slate-950 rounded-2xl items-center justify-center border border-white/5 mb-6 shadow-sm">
                {icon}
            </View>
            <Text className="text-white text-xl font-black tracking-tight">{displayValue}</Text>
            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1.5">{label}</Text>
        </TouchableOpacity>
    );
};

// ─── Upcoming Session Card ───────────────────────────────────────────────────
const UpcomingSessionCard = ({ session, nowMs, onJoin }: { session: any; nowMs: number; onJoin: () => void }) => {
  const sessionTime = new Date(session.scheduled_at).getTime();
  const minutesUntil = (sessionTime - nowMs) / 60_000;
  const canJoin = minutesUntil <= 5;
  const coachName = session.coaches?.profiles?.full_name || 'Your Coach';

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const countdownLabel = () => {
    if (canJoin) return 'Ready to join';
    if (minutesUntil < 60) return `In ${Math.ceil(minutesUntil)} min`;
    const hrs = Math.floor(minutesUntil / 60);
    const mins = Math.round(minutesUntil % 60);
    return mins > 0 ? `In ${hrs}h ${mins}m` : `In ${hrs}h`;
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      className="mb-6 overflow-hidden rounded-[40px]"
      style={{
        backgroundColor: canJoin ? '#1D4ED8' : '#0F172A',
        borderWidth: 1,
        borderColor: canJoin ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.06)',
        shadowColor: canJoin ? '#3B82F6' : '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: canJoin ? 0.35 : 0.2,
        shadowRadius: 20,
        elevation: 8,
      }}
    >
      {/* Decorative glow blob */}
      {canJoin && (
        <View
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(99,179,255,0.15)',
          }}
        />
      )}

      <View style={{ padding: 24 }}>
        {/* Top row — badge + countdown */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: canJoin ? 'rgba(255,255,255,0.15)' : 'rgba(59,130,246,0.12)',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Video size={13} color={canJoin ? '#fff' : '#3B82F6'} />
            </View>
            <Text style={{ color: canJoin ? 'rgba(255,255,255,0.75)' : '#64748B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>
              Live Session
            </Text>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: canJoin ? 'rgba(255,255,255,0.12)' : 'rgba(16,185,129,0.08)',
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
            borderWidth: 1, borderColor: canJoin ? 'rgba(255,255,255,0.15)' : 'rgba(16,185,129,0.15)'
          }}>
            <Clock size={11} color={canJoin ? '#fff' : '#10B981'} />
            <Text style={{ color: canJoin ? '#fff' : '#10B981', fontSize: 11, fontWeight: '800' }}>
              {countdownLabel()}
            </Text>
          </View>
        </View>

        {/* Session info */}
        <Text style={{ color: canJoin ? '#fff' : '#F1F5F9', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>
          Session with {coachName.split(' ')[0]}
        </Text>
        <Text style={{ color: canJoin ? 'rgba(255,255,255,0.6)' : '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 20 }}>
          {formatTime(session.scheduled_at)} · {session.duration_minutes || 60} min
        </Text>

        {/* Join button */}
        <TouchableOpacity
          onPress={canJoin ? onJoin : undefined}
          activeOpacity={canJoin ? 0.7 : 1}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 28,
            backgroundColor: canJoin ? '#fff' : 'rgba(255,255,255,0.05)',
            borderWidth: canJoin ? 0 : 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Video size={16} color={canJoin ? '#1D4ED8' : '#475569'} />
          <Text style={{
            fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5,
            color: canJoin ? '#1D4ED8' : '#475569'
          }}>
            {canJoin ? 'Join Now' : 'Join — Opens Soon'}
          </Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

const ActionCard = ({ label, sub, icon, onPress }: any) => (
    <TouchableOpacity 
        onPress={onPress}
        className="flex-1 bg-slate-900/40 p-8 rounded-[40px] border border-white/5 items-center justify-center gap-4 shadow-xl"
    >
        <View className="w-16 h-16 bg-slate-950 rounded-[24px] items-center justify-center border border-white/5 shadow-inner">
            {icon}
        </View>
        <View className="items-center">
            <Text className="text-white font-black text-lg tracking-tight">{label}</Text>
            <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest mt-1">{sub}</Text>
        </View>
    </TouchableOpacity>
);
