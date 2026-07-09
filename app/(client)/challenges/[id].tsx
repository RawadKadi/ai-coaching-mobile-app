import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, Clock, Dumbbell, Apple, Moon, Zap, ChevronDown, ChevronRight, CheckCircle, Info } from 'lucide-react-native';
import { NestedTaskCard } from '@/components/NestedTaskCard';

export default function ChallengeDetailScreen() {
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
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
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
    <View className="flex-1 bg-slate-950">
      {/* Header with Title */}
      <View className="px-6 pt-16 pb-6 flex-row items-center justify-between bg-slate-950 border-b border-slate-900">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-slate-500 text-xs font-black uppercase tracking-widest">Daily Tasks</Text>
            <Text className="text-white text-lg font-black">{challenge.name}</Text>
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
          <View className="px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
            <Text className="text-blue-500 text-xs font-semibold">Active</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {challenge.description && (
          <View className="mx-6 mt-6">
            <Text className="text-slate-500 text-sm font-medium leading-5">{challenge.description}</Text>
          </View>
        )}

        {/* Performance Overview */}
        <MotiView 
          key={`stats-${challenge.id}`}
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 120 }}
          className="mx-6 mt-6 bg-slate-900 p-6 rounded-[32px] border border-slate-800"
        >
          <View className="flex-row justify-between items-center mb-6">
            <View className={`px-3 py-1 rounded-full border ${isFailed ? 'bg-red-950/30 border-red-900/50' : 'bg-blue-600/10 border-blue-500/20'}`}>
              <Text className={`${isFailed ? 'text-red-500' : 'text-blue-400'} text-[10px] font-bold uppercase tracking-widest`}>
                {isFailed ? 'Failed Phase' : 'Active Phase'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#64748B" />
              <Text className="text-slate-500 text-xs font-medium">Until {new Date(challenge.end_date).toLocaleDateString()}</Text>
            </View>
          </View>

          <View className="flex-row items-baseline gap-2 mb-2">
            <Text className={`text-4xl font-bold ${isFailed ? 'text-red-500' : 'text-white'}`}>{completionRate}%</Text>
            <Text className="text-slate-500 font-medium">{isFailed ? 'Total Compliance' : 'Compliance'}</Text>
          </View>

          <View className={`h-2.5 rounded-full overflow-hidden border mb-6 ${isFailed ? 'bg-red-950/30 border-red-900/30' : 'bg-slate-950 border-slate-800'}`}>
             <View className={`h-full rounded-full ${isFailed ? 'bg-red-900/40' : 'bg-blue-500'}`} style={{ width: isFailed ? '100%' : `${completionRate}%` }} />
          </View>

          <View className="flex-row items-center justify-between bg-slate-950/50 p-4 rounded-3xl border border-white/5">
              <View className="items-center flex-1 border-r border-white/5">
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Done</Text>
                  <Text className={`text-xl font-black ${completedCount > 0 ? 'text-emerald-500' : 'text-white'}`}>{completedCount}</Text>
              </View>
              <View className="items-center flex-1 border-r border-white/5">
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Missed</Text>
                  <Text className={`text-xl font-black ${missedCount > 0 ? (isFailed ? 'text-red-500' : 'text-amber-500') : 'text-white'}`}>{missedCount}</Text>
              </View>
              <View className="items-center flex-1">
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Left</Text>
                  <Text className="text-white text-xl font-black">{remainingCount}</Text>
              </View>
          </View>
        </MotiView>

        {/* Task List / Daily Breakdown */}
        {(!isFailed && !isCompleted) ? (
          <View className="mt-10 px-6">
            <Text className="text-white text-lg font-bold mb-6">Today's Tasks</Text>
            {todayTasks.length === 0 ? (
                <View className="p-6 bg-slate-900/50 border border-slate-800 rounded-3xl items-center">
                    <Text className="text-slate-500 font-medium">No tasks assigned for today.</Text>
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
             <Text className="text-white text-lg font-bold mb-6">Daily Breakdown</Text>
             
             {todayDates.length > 0 && (
               <View className="mb-8">
                 <Text className="text-blue-400 text-sm font-black uppercase tracking-widest mb-3 ml-2">Today</Text>
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
                 <Text className="text-slate-500 text-sm font-black uppercase tracking-widest mb-3 ml-2">Upcoming</Text>
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
                 <Text className="text-slate-500 text-sm font-black uppercase tracking-widest mb-3 ml-2">Previous</Text>
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
        className={`flex-row items-center p-4 rounded-2xl border ${isToday ? 'bg-blue-950/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-800'} ${isExpanded ? 'mb-4' : ''}`}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
            {isExpanded ? <ChevronDown size={16} color="#94A3B8" /> : <ChevronRight size={16} color="#94A3B8" />}
          </View>
          <Text className={`font-black text-xl tracking-tight ${isToday ? 'text-blue-400' : 'text-white'}`}>{isToday ? 'Today, ' : ''}{formattedDate}</Text>
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


