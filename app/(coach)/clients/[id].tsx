import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Habit } from '@/types/database';
import { 
  ArrowLeft, 
  Plus, 
  Calendar as CalendarIcon, 
  Target, 
  Scale, 
  Award, 
  Info, 
  User, 
  Sparkles,
  ChevronRight,
  MoreVertical,
  Zap,
  Clock
} from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import SchedulerModal from '@/components/SchedulerModal';
import PendingResolutionsModal from '@/components/PendingResolutionsModal';
import ConflictResolutionModal from '@/components/ConflictResolutionModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { MotiView, AnimatePresence } from 'moti';

export default function ClientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { coach } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [pendingResolutions, setPendingResolutions] = useState<any[]>([]);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  // Conflict Resolution State
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<any>(null);

  useEffect(() => {
    if (coach && id) {
      loadClientData();
      
      const subscription = supabase
        .channel(`client-details-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `coach_id=eq.${coach.id}` }, () => {
            loadClientData();
        })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [coach, id]);

  const loadClientData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: clientData, error: clientError } = await supabase.rpc('get_client_details', { target_client_id: id });
      if (clientError) throw clientError;
      setClient(clientData);

      const { data: challengesData, error: challengesError } = await supabase.rpc('get_coach_mother_challenges', { 
        p_coach_id: coach?.id,
        p_client_id: id 
      });
      if (challengesError) throw challengesError;
      setChallenges(challengesData || []);

      const { data: sessionsData, error: sessionsError } = await supabase.from('sessions').select(`*, client:clients!sessions_client_id_fkey(id, profiles(full_name))`).eq('coach_id', coach?.id).gte('scheduled_at', new Date().toISOString());
        
      if (!sessionsError && sessionsData) {
          const sessionsWithNames = sessionsData.map(s => ({ ...s, client_name: s.client?.profiles?.full_name || 'Unknown' }));
          setAllCoachSessions(sessionsWithNames);
          const pending = sessionsData.filter(s => s.client_id === id && (s.status === 'pending_resolution' || s.status === 'proposed' || (s.invite_sent === true && s.status === 'scheduled' && !s.cancellation_reason) || (s.cancellation_reason?.startsWith('pending_reschedule')) || (s.cancellation_reason === 'reschedule_rejected')));
          setPendingResolutions(pending);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClientData();
  }, [id, coach]);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!client) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <Text className="text-white font-bold">Client not found</Text>
      </View>
    );
  }

  const filteredChallenges = challenges.filter(c => activeTab === 'active' ? c.status === 'active' : c.status === 'completed');

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-10 pb-6 border-b border-white/5">
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                        <ArrowLeft size={20} color="white" />
                    </TouchableOpacity>
                    <BrandedAvatar name={client.profiles?.full_name} size={40} imageUrl={client.profiles?.avatar_url} />
                    <Text className="text-white text-xl font-black">{client.profiles?.full_name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSchedulerVisible(true)} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                    <CalendarIcon size={20} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {pendingResolutions.length > 0 && (
                <TouchableOpacity 
                    className="mx-6 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex-row items-center justify-between"
                    onPress={() => setPendingModalVisible(true)}
                >
                    <View className="flex-row items-center gap-3">
                        <View className="w-2 h-2 rounded-full bg-amber-500" />
                        <Text className="text-amber-500 font-bold text-xs uppercase tracking-widest">{pendingResolutions.length} Resolutions Pending</Text>
                    </View>
                    <ChevronRight size={16} color="#F59E0B" />
                </TouchableOpacity>
            )}

            <ScrollView 
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
            >
                {/* Client Information Grid */}
                <View className="px-6 py-8">
                    <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mb-6">Physical Intelligence</Text>
                        <View className="flex-row flex-wrap gap-y-6">
                            <InfoTile icon={<Target size={14} color="#64748B" />} label="Goal" value={client.goal || 'Not set'} fullWidth />
                            <InfoTile icon={<Award size={14} color="#64748B" />} label="Experience" value={client.experience_level || 'Not set'} />
                            <InfoTile icon={<Scale size={14} color="#64748B" />} label="Weight" value={client.latest_weight ? `${client.latest_weight} kg` : 'Not set'} />
                            <InfoTile icon={<User size={14} color="#64748B" />} label="Height" value={client.height_cm ? `${client.height_cm} cm` : 'Not set'} />
                            <InfoTile icon={<Clock size={14} color="#64748B" />} label="Age" value={client.date_of_birth ? `${Math.floor((new Date().getTime() - new Date(client.date_of_birth).getTime()) / (1000 * 3600 * 24 * 365.25))}` : 'Not set'} />
                        </View>
                    </View>
                </View>

                {/* Challenges Section */}
                <View className="px-6">
                    <View className="flex-row justify-between items-center mb-8">
                        <View className="flex-row gap-6">
                            <TouchableOpacity onPress={() => setActiveTab('active')}>
                                <Text className={`text-2xl font-black ${activeTab === 'active' ? 'text-white' : 'text-slate-700'}`}>Active</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActiveTab('history')}>
                                <Text className={`text-2xl font-black ${activeTab === 'history' ? 'text-white' : 'text-slate-700'}`}>History</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row gap-2">
                             <TouchableOpacity onPress={() => router.push(`/(coach)/challenges/suggest?clientId=${id}`)} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-white/5 shadow-lg shadow-violet-500/20">
                                <Sparkles size={18} color="#A78BFA" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push(`/(coach)/challenges/create?clientId=${id}`)} className="h-10 px-4 bg-blue-600 rounded-full flex-row items-center gap-2 shadow-lg shadow-blue-500/20">
                                <Plus size={16} color="white" />
                                <Text className="text-white font-black text-xs uppercase">Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {filteredChallenges.length === 0 ? (
                        <View className="p-12 items-center justify-center bg-slate-900/20 rounded-[40px] border border-slate-900 border-dashed">
                             <Zap size={32} color="#1E293B" />
                             <Text className="text-slate-700 font-black text-xs uppercase mt-6">No Challenges Found</Text>
                             <Text className="text-slate-800 text-[10px] mt-2 text-center px-4 leading-4">This client hasn't started any programs yet.</Text>
                        </View>
                    ) : (
                        filteredChallenges.map((challenge, idx) => (
                            <ChallengeCard key={challenge.id} challenge={challenge} coachId={id as string} index={idx} />
                        ))
                    )}

                    {/* Launch Section */}
                    <View className="mt-10 p-10 bg-slate-900/40 rounded-[48px] border border-white/5 items-center">
                        <View className="w-16 h-16 bg-slate-950 rounded-full items-center justify-center border border-white/10 mb-6">
                            <Plus size={32} color="#64748B" />
                        </View>
                        <Text className="text-white text-2xl font-black mb-4 text-center">Launch a New Challenge</Text>
                        <Text className="text-slate-500 text-xs font-medium text-center mb-10 leading-5">
                            Create a bespoke fitness journey or use AI to generate a plan based on client goals.
                        </Text>
                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/challenges/create?clientId=${id}`)}
                                className="flex-1 h-14 bg-slate-950 rounded-full items-center justify-center border border-white/10"
                            >
                                <Text className="text-white font-bold text-xs uppercase">Manual Setup</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/challenges/suggest?clientId=${id}`)}
                                className="flex-1 h-14 bg-orange-200 rounded-full items-center justify-center"
                                style={{ backgroundColor: '#FFD7B5' }}
                            >
                                <Text className="text-slate-900 font-bold text-xs uppercase">AI Generator</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
      </SafeAreaView>

      {/* Scheduler Modal */}
      {client && (
        <SchedulerModal
          visible={schedulerVisible}
          onClose={() => setSchedulerVisible(false)}
          onConfirm={async (s) => { /* handle s */ await loadClientData(); }}
          clientContext={{ name: client.profiles?.full_name || 'Client', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }}
          existingSessions={allCoachSessions}
          targetClientId={id as string}
        />
      )}

      {/* Pending Resolutions Modal */}
      <PendingResolutionsModal
        visible={pendingModalVisible}
        onClose={() => { setPendingModalVisible(false); loadClientData(); }}
        sessions={pendingResolutions}
        onResolve={(session) => {
            setPendingModalVisible(false);
            const proposedStart = new Date(session.scheduled_at).getTime();
            const proposedEnd = proposedStart + (session.duration_minutes || 60) * 60000;
            const existing = allCoachSessions.find(s => s.id !== session.id && s.status !== 'cancelled' && (new Date(s.scheduled_at).getTime() < proposedEnd && (new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60000) > proposedStart));
            if (existing) {
                setCurrentConflict({ existingSession: { ...existing, client_name: existing.client_name }, proposedSession: { ...session, client_name: client.profiles?.full_name || 'Client' }, recommendations: [] });
                setConflictModalVisible(true);
            } else {
                 Alert.alert('No Conflict', 'Confirm this session?', [{ text: 'Cancel' }, { text: 'Confirm', onPress: async () => { await supabase.from('sessions').update({ status: 'scheduled' }).eq('id', session.id); loadClientData(); } }]);
            }
        }}
        onDelete={async (s) => { await supabase.from('sessions').delete().eq('id', s.id); loadClientData(); }}
      />

       {currentConflict && (
        <ConflictResolutionModal 
            visible={conflictModalVisible}
            conflictInfo={currentConflict}
            onCancel={() => { setConflictModalVisible(false); setCurrentConflict(null); }}
            onResolve={async () => { await loadClientData(); setConflictModalVisible(false); setCurrentConflict(null); }}
        />
       )}
    </View>
  );
}

const InfoTile = ({ icon, label, value, fullWidth }: { icon: any, label: string, value: string, fullWidth?: boolean }) => (
    <View style={{ width: fullWidth ? '100%' : '50%' }}>
        <View className="flex-row items-center gap-2 mb-1">
            {icon}
            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{label}</Text>
        </View>
        <Text className="text-white font-bold text-base">{value}</Text>
    </View>
);

const ChallengeCard = ({ challenge, index }: { challenge: any, coachId: string, index: number }) => {
    const router = useRouter();
    return (
        <MotiView 
            from={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ delay: index * 100 }}
            className="bg-slate-900 border border-white/5 rounded-[40px] p-8 mb-6 overflow-hidden"
        >
            <View className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <View className="flex-row justify-between items-start mb-10">
                <View className="flex-row items-center gap-3">
                    <BrandedAvatar name={challenge.name} size={32} />
                    <View>
                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Client</Text>
                        <Text className="text-white font-bold text-sm tracking-tight">{challenge.client_name || 'Individual Protocol'}</Text>
                    </View>
                </View>
                <View className="bg-slate-950 px-3 py-1.5 rounded-full border border-blue-600/20">
                    <Text className="text-blue-500 text-[8px] font-black uppercase tracking-[2px]">High Intensity</Text>
                </View>
            </View>

            <Text className="text-white text-2xl font-black mb-4 tracking-tight">{challenge.name}</Text>
            
            <View className="flex-row items-center gap-4 mb-10">
                <View className="flex-row items-center gap-2">
                    <CalendarIcon size={14} color="#64748B" />
                    <Text className="text-slate-400 text-[11px] font-bold">
                        {new Date(challenge.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(challenge.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                </View>
                <View className="w-1 h-1 rounded-full bg-slate-800" />
                <Text className="text-slate-400 text-[11px] font-bold">7 Days</Text>
            </View>

            <View className="flex-row justify-between items-end mb-3">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Progress</Text>
                <Text className="text-white text-xl font-black tracking-tight">{challenge.completion_rate}%</Text>
            </View>

            <View className="w-full h-2 bg-slate-950 rounded-full overflow-hidden mb-10">
                <View className="h-full bg-blue-600 rounded-full" style={{ width: `${challenge.completion_rate}%` }} />
            </View>

            <View className="flex-row gap-3">
                <TouchableOpacity 
                    onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                    className="flex-1 h-16 bg-blue-600 rounded-[24px] items-center justify-center shadow-2xl shadow-blue-500/20"
                >
                    <Text className="text-white font-black text-base">Manage Plan</Text>
                </TouchableOpacity>
                <TouchableOpacity className="w-16 h-16 bg-slate-950 rounded-[24px] items-center justify-center border border-white/5">
                    <MoreVertical size={20} color="#64748B" />
                </TouchableOpacity>
            </View>
        </MotiView>
    );
};
