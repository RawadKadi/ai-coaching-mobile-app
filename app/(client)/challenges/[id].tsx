import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, Clock, Dumbbell, Apple, Moon, Zap, ChevronDown, ChevronRight, CheckCircle, Info } from 'lucide-react-native';
import { NestedTaskCard } from '@/components/NestedTaskCard';

export default function ChallengeDetailScreen() {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const innerBg = colors.background || (isDark ? '#020617' : '#F8FAFC');

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);
  
  const timeoutRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    loadChallengeDetails();
    if (!id) return;
    const subscription = supabase
      .channel(`challenge-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sub_challenges', filter: `mother_challenge_id=eq.${id}` }, (payload) => {
          setChallenge((current: any) => {
            if (!current) return current;
            const updatedSubChallenges = current.sub_challenges.map((sub: any) => sub.id === payload.new.id ? { ...sub, completed: payload.new.completed, completed_at: payload.new.completed_at } : sub);
            return { ...current, sub_challenges: updatedSubChallenges };
          });
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [id]);

  const loadChallengeDetails = async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_mother_challenge_details', { p_mother_challenge_id: id });
      if (error) throw error;
      if (!data || data.length === 0) { router.back(); return; }
      
      const challengeObj = data[0];

      
      setChallenge(challengeObj);
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendCompletionMessage = async (task: any) => {
    try {
      console.log('[sendCompletionMessage] Starting for task:', task?.name);
      
      // Step 1: get the client record
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, user_id')
        .eq('user_id', user!.id)
        .single();
      
      if (clientError || !clientData) {
        console.error('[sendCompletionMessage] Client lookup failed:', clientError);
        return;
      }
      console.log('[sendCompletionMessage] client id:', clientData.id);

      // Step 2: get active coach link
      const { data: linkData, error: linkError } = await supabase
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', clientData.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      
      if (linkError || !linkData) {
        console.error('[sendCompletionMessage] Link lookup failed:', linkError, 'data:', linkData);
        return;
      }
      console.log('[sendCompletionMessage] coach_id:', linkData.coach_id);

      // Step 3: get coach user_id
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('user_id')
        .eq('id', linkData.coach_id)
        .single();
      
      if (coachError || !coachData) {
        console.error('[sendCompletionMessage] Coach lookup failed:', coachError);
        return;
      }
      console.log('[sendCompletionMessage] coach user_id:', coachData.user_id);

      // Step 4: send the message
      const payload = {
        sender_id: clientData.user_id,
        recipient_id: coachData.user_id,
        content: JSON.stringify({
          type: 'challenge_completed',
          title: 'Client finished this task',
          taskName: task.name || 'Task',
          completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          taskDescription: task.description || '',
          focusType: task.focus_type || '',
          intensity: task.intensity || '',
        }),
        read: false,
        ai_generated: false,
      };

      const { error: insertError } = await supabase.from('messages').insert(payload);
      
      if (insertError) {
        console.error('[sendCompletionMessage] Insert FAILED:', insertError);
      } else {
        console.log('[sendCompletionMessage] ✅ Message sent successfully!');
      }
    } catch (error) {
      console.error('[sendCompletionMessage] Exception:', error);
    }
  };

  const toggleSubChallenge = async (sub: any) => {
    try {
      const newCompleted = !sub.completed;

      if (timeoutRefs.current[sub.id]) {
        clearTimeout(timeoutRefs.current[sub.id]);
        delete timeoutRefs.current[sub.id];
      }

      setChallenge((prev: any) => {
        if (!prev) return prev;
        const updatedSubChallenges = prev.sub_challenges.map((s: any) => 
          s.id === sub.id ? { ...s, completed: newCompleted } : s
        );
        return { ...prev, sub_challenges: updatedSubChallenges };
      });
      
      const { data: cData } = await supabase.from('clients').select('id').eq('user_id', user!.id).single();
      if (!cData) return;
      await supabase.rpc('mark_sub_challenge', { p_sub_challenge_id: sub.id, p_client_id: cData.id, p_completed: newCompleted });

      if (newCompleted) {
        // Send immediately - no timer
        sendCompletionMessage(sub);
      }
    } catch (e) { 
      loadChallengeDetails(); 
    }
  };



  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!challenge) return null;

  const completedCount = challenge.sub_challenges?.filter((s: any) => s.completed).length || 0;
  const totalCount = challenge.sub_challenges?.length || 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const now = new Date();
  now.setHours(0,0,0,0);
  const missedCount = challenge.sub_challenges?.filter((s: any) => !s.completed && new Date(s.assigned_date) < now).length || 0;
  const remainingCount = Math.max(0, totalCount - completedCount - missedCount);

  const isEnded = challenge.status !== 'active' || new Date(challenge.end_date) < new Date(new Date().setHours(0,0,0,0));
  const isFailed = isEnded && completedCount === 0;
  const isCompleted = isEnded && completedCount > 0;

  const groupedTasks: Record<string, any[]> = {};
  if (challenge?.sub_challenges) {
    challenge.sub_challenges.forEach((task: any) => {
      const dateKey = new Date(task.assigned_date).toISOString().split('T')[0];
      if (!groupedTasks[dateKey]) groupedTasks[dateKey] = [];
      groupedTasks[dateKey].push(task);
    });
  }

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const todayKeyGlobal = new Date().toISOString().split('T')[0];
  const todayDates = sortedDates.filter(d => d === todayKeyGlobal);
  const upcomingDates = sortedDates.filter(d => d > todayKeyGlobal);
  const previousDates = sortedDates.filter(d => d < todayKeyGlobal);

  const todayTasks = groupedTasks[todayKeyGlobal] || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header with Title */}
      <View style={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: cardBorder }}>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, backgroundColor: cardBg, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cardBorder }}>
            <ArrowLeft size={20} color={textColor} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: textSecondaryColor, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>Daily Tasks</Text>
            <Text style={{ color: textColor, fontSize: 18, fontWeight: '900' }}>{challenge.name}</Text>
          </View>
        </View>
        {isFailed ? (
          <View className="px-3 py-1.5 bg-red-950/50 rounded-full border border-red-900/50">
            <Text className="text-red-500 text-xs font-semibold">Failed</Text>
          </View>
        ) : isCompleted ? (
          <View className="px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <Text className="text-emerald-500 text-xs font-semibold">Completed</Text>
          </View>
        ) : (
          <View className="px-3 py-1.5 rounded-full border" style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}33` }}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Active</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {challenge.description && (
          <View className="mx-6 mt-6">
            <Text style={{ color: textSecondaryColor, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>{challenge.description}</Text>
          </View>
        )}

        {/* Performance Overview */}
        <MotiView 
          key={`stats-${challenge.id}`}
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 120 }}
          style={{ marginHorizontal: 24, marginTop: 24, backgroundColor: cardBg, padding: 24, borderRadius: 32, borderWidth: 1, borderColor: cardBorder }}
        >
          <View className="flex-row justify-between items-center mb-6">
            <View className={`px-3 py-1 rounded-full border ${isFailed ? 'bg-red-950/30 border-red-900/50' : ''}`} style={!isFailed ? { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}33` } : undefined}>
              <Text className={`${isFailed ? 'text-red-500' : ''} text-[10px] font-bold uppercase tracking-widest`} style={!isFailed ? { color: colors.primary } : undefined}>
                {isFailed ? 'Failed Phase' : 'Active Phase'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color={textSecondaryColor} />
              <Text style={{ color: textSecondaryColor, fontSize: 12, fontWeight: '500' }}>Until {new Date(challenge.end_date).toLocaleDateString()}</Text>
            </View>
          </View>

          <View className="flex-row items-baseline gap-2 mb-2">
            <Text style={{ fontSize: 36, fontWeight: '900', color: isFailed ? '#EF4444' : textColor }}>{completionRate}%</Text>
            <Text style={{ color: textSecondaryColor, fontWeight: '500' }}>{isFailed ? 'Total Compliance' : 'Compliance'}</Text>
          </View>

          <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: cardBorder, marginBottom: 24, backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
             <View style={{ height: '100%', borderRadius: 999, backgroundColor: isFailed ? '#EF4444' : colors.primary, width: isFailed ? '100%' : `${completionRate}%` }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: innerBg, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: cardBorder }}>
              <View style={{ alignItems: 'center', flex: 1, borderRightWidth: 1, borderRightColor: cardBorder }}>
                  <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Done</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: completedCount > 0 ? '#10B981' : textColor }}>{completedCount}</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1, borderRightWidth: 1, borderRightColor: cardBorder }}>
                  <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Missed</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: missedCount > 0 ? (isFailed ? '#EF4444' : '#F59E0B') : textColor }}>{missedCount}</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: textSecondaryColor, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Left</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: textColor }}>{remainingCount}</Text>
              </View>
          </View>
        </MotiView>

        {/* Task List / Daily Breakdown */}
        {(!isFailed && !isCompleted) ? (
          <View className="mt-10 px-6">
            <Text style={{ color: textColor, fontSize: 18, fontWeight: '900', marginBottom: 24 }}>Today's Tasks</Text>
            {todayTasks.length === 0 ? (
                <View style={{ padding: 24, backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder, borderRadius: 24, alignItems: 'center' }}>
                    <Text style={{ color: textSecondaryColor, fontWeight: '500' }}>No tasks assigned for today.</Text>
                </View>
            ) : (
                <View className="gap-3">
                    {todayTasks.map((sub: any, idx: number) => (
                        <NestedTaskCard 
                            key={sub.id}
                            task={sub}
                            index={idx}
                            onToggleParent={toggleSubChallenge}
                            layoutType="feed"
                        />
                    ))}
                </View>
            )}
          </View>
        ) : (
          <View className="mt-10 px-6">
             <Text style={{ color: textColor, fontSize: 18, fontWeight: '900', marginBottom: 24 }}>Daily Breakdown</Text>
             
             {todayDates.length > 0 && (
               <View className="mb-8">
                 <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8 }}>Today</Text>
                 {todayDates.map((dateStr: string, index: number) => (
                   <MotiView
                     key={dateStr}
                     from={{ opacity: 0, translateY: 20 }}
                     animate={{ opacity: 1, translateY: 0 }}
                     transition={{ delay: index * 80 }}
                   >
                     <DateSection dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
                   </MotiView>
                 ))}
               </View>
             )}

             {upcomingDates.length > 0 && (
               <View className="mb-8">
                 <Text style={{ color: textSecondaryColor, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8 }}>Upcoming</Text>
                 {upcomingDates.map((dateStr: string, index: number) => (
                   <MotiView
                     key={dateStr}
                     from={{ opacity: 0, translateY: 20 }}
                     animate={{ opacity: 1, translateY: 0 }}
                     transition={{ delay: index * 80 }}
                   >
                     <DateSection dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
                   </MotiView>
                 ))}
               </View>
             )}

             {previousDates.length > 0 && (
               <View className="mb-8">
                 <Text style={{ color: textSecondaryColor, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8 }}>Previous</Text>
                 {previousDates.map((dateStr: string, index: number) => (
                   <MotiView
                     key={dateStr}
                     from={{ opacity: 0, translateY: 20 }}
                     animate={{ opacity: 1, translateY: 0 }}
                     transition={{ delay: index * 80 }}
                   >
                     <DateSection dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
                   </MotiView>
                 ))}
               </View>
             )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const DateSection = ({ dateStr, tasks, isFailed, isCompleted, index }: any) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const innerBg = colors.background || (isDark ? '#020617' : '#F8FAFC');

  const [isExpanded, setIsExpanded] = useState(() => {
    const todayKey = new Date().toISOString().split('T')[0];
    return dateStr === todayKey;
  });
  const completedCount = tasks.filter((t: any) => t.completed).length;
  const totalCount = tasks.length;
  
  // Adding timezone offset to prevent day shifting backwards
  const dateObj = new Date(dateStr);
  const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
  const localDate = new Date(dateObj.getTime() + userTimezoneOffset);
  const formattedDate = localDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const todayKey = new Date().toISOString().split('T')[0];
  const isToday = dateStr === todayKey;
  const isPastDate = dateStr < todayKey;
  const isFutureDate = dateStr > todayKey;

  let tagBg = 'bg-slate-950 border-slate-800';
  let tagText = 'text-slate-300';
  
  if (!isFutureDate) {
    if (completedCount > 0) {
      tagBg = 'bg-emerald-500/10 border-emerald-500/20';
      tagText = 'text-emerald-500';
    } else {
      tagBg = 'bg-amber-500/10 border-amber-500/20';
      tagText = 'text-amber-500';
    }
  }

  return (
    <View className="mb-[7px]">
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={() => setIsExpanded(!isExpanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isToday ? colors.primary : cardBorder,
          backgroundColor: isToday ? `${colors.primary}15` : cardBg,
          marginBottom: isExpanded ? 16 : 0
        }}
      >
        <View className="flex-row items-center gap-3">
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: innerBg, borderWidth: 1, borderColor: cardBorder, alignItems: 'center', justifyContent: 'center' }}>
            {isExpanded ? <ChevronDown size={16} color={textSecondaryColor} /> : <ChevronRight size={16} color={textSecondaryColor} />}
          </View>
          <Text style={{ fontWeight: '900', fontSize: 18, letterSpacing: -0.5, color: isToday ? colors.primary : textColor }}>
            {isToday ? 'Today, ' : ''}{formattedDate}
          </Text>
          <View className={`px-3 py-1 rounded-full border ml-1 ${tagBg} ${isPastDate ? 'opacity-50' : ''}`}>
             <Text className={`text-sm font-bold ${tagText}`}>{completedCount}/{totalCount} Done</Text>
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View>
          {tasks.map((task: any, idx: number) => (
             <NestedTaskCard 
                 key={task.id} 
                 task={task} 
                 index={idx} 
                 isFailed={isFailed} 
                 isCompleted={isCompleted} 
                 onToggleParent={() => {}} 
                 layoutType="detail" 
             />
          ))}
        </View>
      )}
    </View>
  );
};


