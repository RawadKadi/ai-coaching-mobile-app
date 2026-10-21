import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, X, Calendar, Clock, Dumbbell, Apple, Moon, Zap, Edit2, ChevronDown, ChevronRight } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

export default function ChallengeDetailScreen() {
  const colors = useBrandColors();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);

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

      // Fetch client details including avatar and email via existing RPC to bypass RLS
      const { data: extraData } = await supabase
        .from('mother_challenges')
        .select('client_id')
        .eq('id', id)
        .single();

      if (extraData?.client_id) {
        const { data: clientDetails } = await supabase
          .rpc('get_client_details', { target_client_id: extraData.client_id });

        if (clientDetails && clientDetails.profiles) {
          challengeObj.client_avatar = clientDetails.profiles.avatar_url;
          challengeObj.client_email = clientDetails.profiles.email;
        }
      }
      
      setChallenge(challengeObj);
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Challenge', 'Are you sure you want to cancel this challenge?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          try {
            await supabase.rpc('cancel_mother_challenge', { p_mother_challenge_id: id });
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to cancel');
          }
      }},
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
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

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header with Client Profile Picture and Name */}
      <View 
        className="px-6 pt-16 pb-6 flex-row items-center justify-between border-b"
        style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}
      >
        <View className="flex-row items-center gap-4">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 rounded-xl items-center justify-center border"
            style={{ backgroundColor: colors.background, borderColor: colors.border }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <BrandedAvatar name={challenge.client_name || 'Client'} size={40} imageUrl={challenge.client_avatar} />
          <View>
            <Text className="text-lg font-black" style={{ color: colors.text }}>{challenge.client_name || 'Client'}</Text>
            {challenge.client_email ? (
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>{challenge.client_email}</Text>
            ) : (
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Tracking progress</Text>
            )}
          </View>
        </View>
        {isFailed ? (
          <View className="px-3 py-1.5 bg-red-950/50 rounded-full border border-red-900/50">
            <Text className="text-red-500 text-xs font-semibold">⚠️ Closed</Text>
          </View>
        ) : isCompleted ? (
          <View className="px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <Text className="text-emerald-500 text-xs font-semibold">✅ Completed</Text>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={handleCancel} 
            className="flex-row items-center gap-1.5 px-3 py-1.5 bg-red-500/10 rounded-full border border-red-500/20"
          >
            <X size={12} color="#EF4444" />
            <Text className="text-red-500 text-xs font-semibold">Cancel Plan</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Dynamic Challenge Name/Title in Main Content */}
        <View className="mx-6 mt-8">
          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>{challenge.name}</Text>
          {challenge.description && (
            <Text className="text-sm font-medium mt-2 leading-5" style={{ color: colors.textSecondary }}>{challenge.description}</Text>
          )}
        </View>

        {/* Performance Overview */}
        <MotiView 
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-6 mt-6 p-6 rounded-[32px] border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row justify-between items-center mb-6">
            <View 
              className="px-3 py-1 rounded-full border"
              style={{
                backgroundColor: isFailed ? 'rgba(239, 68, 68, 0.1)' : `${colors.primary}15`,
                borderColor: isFailed ? 'rgba(239, 68, 68, 0.3)' : `${colors.primary}30`
              }}
            >
              <Text 
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: isFailed ? '#EF4444' : colors.primary }}
              >
                {isFailed ? 'Closed' : 'Active'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color={colors.textSecondary} />
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Until {new Date(challenge.end_date).toLocaleDateString()}</Text>
            </View>
          </View>

          <View className="flex-row items-baseline gap-2 mb-2">
            <Text 
              className="text-4xl font-bold"
              style={{ color: isFailed ? '#EF4444' : colors.text }}
            >
              {completionRate}%
            </Text>
            <Text className="font-medium" style={{ color: colors.textSecondary }}>Progress</Text>
          </View>

          <View 
            className="h-2.5 rounded-full overflow-hidden border mb-6"
            style={{ 
              backgroundColor: colors.background, 
              borderColor: colors.border 
            }}
          >
             <View 
               className="h-full rounded-full" 
               style={{ 
                 width: isFailed ? '100%' : `${completionRate}%`,
                 backgroundColor: isFailed ? '#EF4444' : colors.primary
               }} 
             />
          </View>

          <View 
            className="flex-row items-center justify-between p-4 rounded-3xl border"
            style={{ backgroundColor: colors.background, borderColor: colors.border }}
          >
              <View className="items-center flex-1 border-r" style={{ borderRightColor: colors.border }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: colors.textSecondary }}>Done</Text>
                  <Text className="text-xl font-black text-emerald-500">{completedCount}</Text>
              </View>
              <View className="items-center flex-1 border-r" style={{ borderRightColor: colors.border }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: colors.textSecondary }}>Missed</Text>
                  <Text className={`text-xl font-black ${missedCount > 0 ? 'text-amber-500' : ''}`} style={missedCount === 0 ? { color: colors.text } : undefined}>{missedCount}</Text>
              </View>
              <View className="items-center flex-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: colors.textSecondary }}>Left</Text>
                  <Text className="text-xl font-black" style={{ color: colors.text }}>{remainingCount}</Text>
              </View>
          </View>
        </MotiView>

        {/* Task List */}
        <View className="mt-10 px-6">
           <Text className="text-lg font-bold mb-6" style={{ color: colors.text }}>Daily Tasks</Text>
           
           {todayDates.length > 0 && (
             <View className="mb-8">
               <Text className="text-sm font-black uppercase tracking-widest mb-3 ml-2" style={{ color: colors.primary }}>Today</Text>
               {todayDates.map((dateStr: string, index: number) => (
                 <DateSection key={dateStr} dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
               ))}
             </View>
           )}

           {upcomingDates.length > 0 && (
             <View className="mb-8">
               <Text className="text-sm font-black uppercase tracking-widest mb-3 ml-2" style={{ color: colors.textSecondary }}>Upcoming</Text>
               {upcomingDates.map((dateStr: string, index: number) => (
                 <DateSection key={dateStr} dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
               ))}
             </View>
           )}

           {previousDates.length > 0 && (
             <View className="mb-8">
               <Text className="text-sm font-black uppercase tracking-widest mb-3 ml-2" style={{ color: colors.textSecondary }}>Previous</Text>
               {previousDates.map((dateStr: string, index: number) => (
                 <DateSection key={dateStr} dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
               ))}
             </View>
           )}
        </View>
      </ScrollView>

      {/* Fixed Edit Plan Button at Bottom Right while scrolling */}
      {!isFailed && !isCompleted && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/(coach)/challenges/edit/${id}`)}
          style={{ position: 'absolute', bottom: 32, right: 24, zIndex: 10, backgroundColor: colors.primary }}
          className="px-4 py-2.5 rounded-full flex-row items-center gap-1.5 shadow-2xl"
        >
          <Text className="text-xs font-semibold" style={{ color: colors.textOnPrimary }}>Edit Challenge</Text>
          <Edit2 size={12} color={colors.textOnPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const DateSection = ({ dateStr, tasks, isFailed, isCompleted, index }: any) => {
  const colors = useBrandColors();
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

  let tagBgStyle = { backgroundColor: colors.background, borderColor: colors.border };
  let tagTextColor = colors.textSecondary;
  
  if (!isFutureDate) {
    if (completedCount > 0) {
      tagBgStyle = { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' };
      tagTextColor = '#10B981';
    } else {
      tagBgStyle = { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' };
      tagTextColor = '#F59E0B';
    }
  }

  return (
    <View className="mb-[7px]">
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={() => setIsExpanded(!isExpanded)}
        className={`flex-row items-center p-4 rounded-2xl border ${isExpanded ? 'mb-4' : ''}`}
        style={{
          backgroundColor: isToday ? `${colors.primary}12` : colors.surface,
          borderColor: isToday ? colors.primary : colors.border
        }}
      >
        <View className="flex-row items-center gap-3">
          <View 
            className="w-8 h-8 rounded-full items-center justify-center border"
            style={{ backgroundColor: colors.background, borderColor: colors.border }}
          >
            {isExpanded ? <ChevronDown size={16} color={colors.textSecondary} /> : <ChevronRight size={16} color={colors.textSecondary} />}
          </View>
          <Text 
            className="font-black text-xl tracking-tight"
            style={{ color: isToday ? colors.primary : colors.text }}
          >
            {isToday ? 'Today, ' : ''}{formattedDate}
          </Text>
          <View 
            className={`px-3 py-1 rounded-full border ml-1 ${isPastDate ? 'opacity-50' : ''}`}
            style={tagBgStyle}
          >
             <Text className="text-sm font-bold" style={{ color: tagTextColor }}>{completedCount}/{totalCount} Done</Text>
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View>
          {tasks.map((task: any, idx: number) => (
             <TaskCard key={task.id} task={task} index={idx} isFailed={isFailed} isCompleted={isCompleted} />
          ))}
        </View>
      )}
    </View>
  );
};

interface ParsedTaskInfo {
  isJson: boolean;
  rule?: string;
  subTasks?: Array<{
    id?: string;
    exercise?: string;
    name?: string;
    sets?: number;
    notes?: string;
  }>;
  text?: string;
}

const parseTaskDescription = (desc: any): ParsedTaskInfo => {
  if (!desc) return { isJson: false, text: '' };
  if (typeof desc !== 'string') return { isJson: false, text: String(desc) };

  const trimmed = desc.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { isJson: false, text: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const subTasks = Array.isArray(parsed.sub_tasks)
        ? parsed.sub_tasks
        : Array.isArray(parsed.exercises)
          ? parsed.exercises
          : Array.isArray(parsed)
            ? parsed
            : [];
      const rule = parsed.global_rule || parsed.rule || parsed.instructions || '';
      return {
        isJson: true,
        rule,
        subTasks,
      };
    }
  } catch {
    // Parsing error fallback to plain text
  }

  return { isJson: false, text: trimmed };
};

const TaskCard = ({ task, index, isFailed, isCompleted }: { task: any, index: number, isFailed?: boolean, isCompleted?: boolean }) => {
  const colors = useBrandColors();
  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'training': return <Dumbbell size={22} color={colors.primary} />;
      case 'nutrition': return <Apple size={22} color="#10B981" />;
      case 'recovery': return <Moon size={22} color="#8B5CF6" />;
      default: return <Zap size={22} color="#F59E0B" />;
    }
  };

  const isPast = new Date(task.assigned_date) < new Date(new Date().setHours(0,0,0,0));
  const parsed = parseTaskDescription(task.description);

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 100 }}
      className={`mb-4 p-5 rounded-[24px] border ${isFailed || (isCompleted && !task.completed) || isPast ? 'opacity-60' : ''}`}
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      {/* Card Header: flex-1 on left and flex-shrink-0 on badge prevents badge from overflowing */}
      <View className="flex-row justify-between items-start mb-3 gap-3">
        <View className="flex-row items-start gap-3 flex-1 min-w-0">
          <View 
            className="w-10 h-10 rounded-xl items-center justify-center border flex-shrink-0 mt-0.5"
            style={{ backgroundColor: colors.background, borderColor: colors.border }}
          >
             {getIcon(task.focus_type)}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="font-bold text-base leading-snug" style={{ color: colors.text }} numberOfLines={2}>
              {task.name}
            </Text>
            <Text className="text-xs font-medium capitalize mt-1" style={{ color: colors.textSecondary }}>
              {task.focus_type} • {task.intensity}
            </Text>
          </View>
        </View>

        <View className="flex-shrink-0 pt-0.5">
          {isFailed ? (
            <View className="bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
               <Text className="text-red-500 text-[10px] font-bold uppercase">Unfulfilled</Text>
            </View>
          ) : task.completed ? (
            <View className="bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
               <Text className="text-emerald-500 text-[10px] font-bold uppercase">Done</Text>
            </View>
          ) : isPast ? (
              <View className="bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20">
                  <Text className="text-red-500 text-[10px] font-bold uppercase">Missed</Text>
              </View>
          ) : (
            <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
               <Text className="text-[10px] font-bold uppercase" style={{ color: colors.textSecondary }}>Pending</Text>
            </View>
          )}
        </View>
      </View>

      {/* Card Content */}
      <View className="pl-[52px]">
        {parsed.isJson ? (
          <View className="mb-4">
            {parsed.rule ? (
              <Text className="text-sm leading-5 mb-3 font-medium" style={{ color: colors.textSecondary }}>
                {parsed.rule}
              </Text>
            ) : null}

            {parsed.subTasks && parsed.subTasks.length > 0 && (
              <View className="gap-2">
                {parsed.subTasks.map((st: any, i: number) => (
                  <View 
                    key={st.id || i}
                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                    className="p-3 rounded-xl border flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-bold" style={{ color: colors.text }}>
                        {st.exercise || st.name || `Exercise ${i + 1}`}
                      </Text>
                      {st.notes ? (
                        <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                          {st.notes}
                        </Text>
                      ) : null}
                    </View>
                    {st.sets ? (
                      <View 
                        style={{ backgroundColor: `${colors.primary}15` }}
                        className="px-2.5 py-1 rounded-lg"
                      >
                        <Text className="text-xs font-black" style={{ color: colors.primary }}>
                          {st.sets} {st.sets === 1 ? 'Set' : 'Sets'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : parsed.text ? (
          <Text className="text-sm leading-5 mb-4" style={{ color: colors.textSecondary }}>
            {parsed.text}
          </Text>
        ) : null}

        <View className="flex-row justify-between items-center pt-3 border-t" style={{ borderTopColor: colors.border }}>
           <View className="flex-row items-center gap-2">
              <Clock size={12} color={colors.textTertiary} />
              <Text className="text-[10px] font-bold uppercase" style={{ color: colors.textTertiary }}>
                {new Date(task.assigned_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
           </View>
        </View>
      </View>
    </MotiView>
  );
};
