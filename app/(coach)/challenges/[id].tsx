import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, X, Calendar, Clock, Dumbbell, Apple, Moon, Zap, Edit2, ChevronDown, ChevronRight } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

export default function ChallengeDetailScreen() {
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

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header with Client Profile Picture and Name */}
      <View className="px-6 pt-16 pb-6 flex-row items-center justify-between bg-slate-950 border-b border-slate-900">
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <BrandedAvatar name={challenge.client_name || 'Client'} size={40} imageUrl={challenge.client_avatar} />
          <View>
            <Text className="text-white text-lg font-black">{challenge.client_name || 'Client'}</Text>
            {challenge.client_email ? (
              <Text className="text-slate-500 text-xs font-medium">{challenge.client_email}</Text>
            ) : (
              <Text className="text-slate-500 text-xs font-medium">Tracking progress</Text>
            )}
          </View>
        </View>
        {isFailed ? (
          <View className="px-3 py-1.5 bg-red-950/50 rounded-full border border-red-900/50">
            <Text className="text-red-500 text-xs font-semibold">⚠️ Closed / Unfulfilled</Text>
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
            <Text className="text-red-500 text-xs font-semibold">cancel plan</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Dynamic Challenge Name/Title in Main Content */}
        <View className="mx-6 mt-8">
          <Text className="text-white text-2xl font-black tracking-tight">{challenge.name}</Text>
          {challenge.description && (
            <Text className="text-slate-500 text-sm font-medium mt-2 leading-5">{challenge.description}</Text>
          )}
        </View>

        {/* Performance Overview */}
        <MotiView 
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
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

        {/* Task List */}
        <View className="mt-10 px-6">
           <Text className="text-white text-lg font-bold mb-6">Daily Breakdown</Text>
           
           {todayDates.length > 0 && (
             <View className="mb-8">
               <Text className="text-blue-400 text-sm font-black uppercase tracking-widest mb-3 ml-2">Today</Text>
               {todayDates.map((dateStr: string, index: number) => (
                 <DateSection key={dateStr} dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
               ))}
             </View>
           )}

           {upcomingDates.length > 0 && (
             <View className="mb-8">
               <Text className="text-slate-500 text-sm font-black uppercase tracking-widest mb-3 ml-2">Upcoming</Text>
               {upcomingDates.map((dateStr: string, index: number) => (
                 <DateSection key={dateStr} dateStr={dateStr} tasks={groupedTasks[dateStr]} index={index} isFailed={isFailed} isCompleted={isCompleted} />
               ))}
             </View>
           )}

           {previousDates.length > 0 && (
             <View className="mb-8">
               <Text className="text-slate-500 text-sm font-black uppercase tracking-widest mb-3 ml-2">Previous</Text>
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
          style={{ position: 'absolute', bottom: 32, right: 24, zIndex: 10 }}
          className="bg-blue-600 px-4 py-2.5 rounded-full flex-row items-center gap-1.5 shadow-2xl shadow-blue-500/30 border border-blue-500/20"
        >
          <Text className="text-white text-xs font-semibold">edit plan</Text>
          <Edit2 size={12} color="white" />
        </TouchableOpacity>
      )}
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
             <TaskCard key={task.id} task={task} index={idx} isFailed={isFailed} isCompleted={isCompleted} />
          ))}
        </View>
      )}
    </View>
  );
};

const TaskCard = ({ task, index, isFailed, isCompleted }: { task: any, index: number, isFailed?: boolean, isCompleted?: boolean }) => {
  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'training': return <Dumbbell size={24} color="#3B82F6" />;
      case 'nutrition': return <Apple size={24} color="#10B981" />;
      case 'recovery': return <Moon size={24} color="#8B5CF6" />;
      default: return <Zap size={24} color="#F59E0B" />;
    }
  };

  const isPast = new Date(task.assigned_date) < new Date(new Date().setHours(0,0,0,0));

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 100 }}
      className={`mb-4 p-5 rounded-[24px] border ${isFailed || (isCompleted && !task.completed) || isPast ? 'bg-slate-900/50 border-slate-800/50 opacity-50' : 'bg-slate-900 border-slate-800'}`}
    >
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-slate-800">
             {getIcon(task.focus_type)}
          </View>
          <View>
            <Text className="text-white font-bold text-base">{task.name}</Text>
            <Text className="text-slate-500 text-xs font-medium capitalize">{task.focus_type} • {task.intensity}</Text>
          </View>
        </View>
        {isFailed ? (
          <View className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
             <Text className="text-red-500 text-[10px] font-bold uppercase">Unfulfilled</Text>
          </View>
        ) : task.completed ? (
          <View className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
             <Text className="text-emerald-500 text-[10px] font-bold uppercase">Success</Text>
          </View>
        ) : isPast ? (
            <View className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <Text className="text-red-500 text-[10px] font-bold uppercase">Missed</Text>
            </View>
        ) : (
          <View className="bg-slate-800 px-3 py-1 rounded-full">
             <Text className="text-slate-400 text-[10px] font-bold uppercase">Pending</Text>
          </View>
        )}
      </View>

      <View className="pl-[52px]">
         <Text className="text-slate-400 text-sm leading-5 mb-4" numberOfLines={2}>{task.description}</Text>
         <View className="flex-row justify-between items-center pt-4 border-t border-slate-950/50">
           <View className="flex-row items-center gap-2">
              <Clock size={12} color="#475569" />
              <Text className="text-slate-500 text-[10px] font-bold uppercase">
                {new Date(task.assigned_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
           </View>
         </View>
      </View>
    </MotiView>
  );
};
