import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  TouchableWithoutFeedback, 
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Target, 
  Sparkles, 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  MoreVertical, 
  Trash2, 
  Edit2 
} from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { MotherChallengeWithProgress } from '@/types/challenges-v3';
import { BrandedAvatar } from '@/components/BrandedAvatar';

export default function CoachChallengesDashboard() {
  const router = useRouter();
  const { user, coach } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChallenges, setActiveChallenges] = useState<MotherChallengeWithProgress[]>([]);
  const [historyChallenges, setHistoryChallenges] = useState<MotherChallengeWithProgress[]>([]);
  const [isEditingChallenges, setIsEditingChallenges] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [coach])
  );

  useEffect(() => {
    if (!user) return;
    const subscription = supabase
      .channel('sub-challenges-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sub_challenges' }, () => {
          loadChallenges();
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [user]);

  const loadChallenges = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_mother_challenges', {
        p_coach_id: coach.id,
      });
      if (error) throw error;
      const active = (data || []).filter((c: any) => c.status === 'active');
      const history = (data || []).filter((c: any) => c.status !== 'active');
      setActiveChallenges(active);
      setHistoryChallenges(history);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    Alert.alert(
      'Remove Challenge',
      'Are you sure? This will delete the challenge and all progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('mother_challenges').delete().eq('id', challengeId);
              if (error) throw error;
              setActiveChallenges(prev => prev.filter(c => c.id !== challengeId));
              setHistoryChallenges(prev => prev.filter(c => c.id !== challengeId));
            } catch (error) {
              console.error('Error deleting challenge:', error);
              Alert.alert('Error', 'Failed to delete challenge');
            }
          }
        }
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const challenges = activeTab === 'active' ? activeChallenges : historyChallenges;

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 pt-20 pb-6 flex-row items-center gap-4 bg-slate-950 shadow-2xl z-10">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-white/5"
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View>
          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Growth Tracking</Text>
          <Text className="text-white text-3xl font-black mt-0.5 tracking-tight">Challenges</Text>
        </View>
      </View>

      {/* Tabs / Filters (Directly identical to Screenshot 2 layout) */}
      <View className="px-6 py-4 flex-row justify-between items-center mb-4">
        <View className="flex-row gap-6">
          <TouchableOpacity onPress={() => setActiveTab('active')}>
            <Text className={`text-2xl font-black ${activeTab === 'active' ? 'text-white' : 'text-slate-700'}`}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('history')}>
            <Text className={`text-2xl font-black ${activeTab === 'history' ? 'text-white' : 'text-slate-700'}`}>History</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity 
            onPress={() => router.push('/(coach)/challenges/suggest')} 
            className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-white/5 shadow-lg shadow-violet-500/20"
          >
            <Sparkles size={18} color="#A78BFA" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/(coach)/challenges/create')} 
            className="h-10 px-4 bg-blue-600 rounded-full flex-row items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} color="white" />
            <Text className="text-white font-black text-xs uppercase">Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}
      >
        <AnimatePresence>
          {challenges.length === 0 ? (
            <MotiView 
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 mt-12 items-center"
            >
              <View className="w-20 h-20 bg-slate-900 rounded-full items-center justify-center border border-slate-800 mb-6">
                <Target size={32} color="#475569" />
              </View>
              <Text className="text-white text-xl font-bold mb-2">No {activeTab} challenges</Text>
              <Text className="text-slate-500 text-center px-8 leading-5">
                {activeTab === 'active' 
                  ? "Start an AI-assisted training plan to keep your clients engaged." 
                  : "Completed plans will appear in your history tab."
                }
              </Text>
              <TouchableOpacity 
                className="mt-8 bg-slate-900 border border-slate-800 py-3 px-8 rounded-2xl"
                onPress={() => router.push('/(coach)/challenges/create')}
              >
                <Text className="text-white font-bold">Create Manually</Text>
              </TouchableOpacity>
            </MotiView>
          ) : (
            challenges.map((challenge, index) => (
              <ChallengeCard 
                key={challenge.id} 
                challenge={challenge} 
                index={index} 
                isEditing={isEditingChallenges}
                onDelete={() => handleDeleteChallenge(challenge.id)}
              />
            ))
          )}
        </AnimatePresence>
      </ScrollView>
    </View>
  );
}

const ChallengeCard = ({ challenge, index, isEditing, onDelete }: { challenge: any, index: number, isEditing?: boolean, onDelete?: () => void }) => {
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);
    const totalSubs = Number(challenge.total_subs || 0);
    const completedSubs = Number(challenge.completed_subs || 0);
    const completionRate = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const totalDays = Math.max(1, Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / (1000 * 3600 * 24)));
    
    return (
        <Swipeable
            renderRightActions={() => (
                <View className="flex-row mb-6 pl-4 h-[280px]">
                    <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                        className="w-16 h-full bg-slate-800 rounded-3xl items-center justify-center border border-white/5 mr-2"
                    >
                        <Edit2 size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={onDelete}
                        className="w-16 h-full bg-red-500 rounded-3xl items-center justify-center shadow-lg shadow-red-500/20"
                    >
                        <Trash2 size={20} color="white" />
                    </TouchableOpacity>
                </View>
            )}
            enabled={isEditing}
        >
            <MotiView 
                from={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: index * 100 }}
                className="mx-6 bg-slate-900 border border-white/5 rounded-[40px] p-8 mb-6 overflow-hidden"
            >
                <View className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                >
                    <View className="flex-row justify-between items-start mb-10">
                        <View className="flex-row items-center gap-3">
                            <BrandedAvatar name={challenge.client_name || 'Client'} size={32} imageUrl={challenge.client_avatar} />
                            <View>
                                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Client</Text>
                                <Text className="text-white font-bold text-sm tracking-tight">{challenge.client_name || 'Individual'}</Text>
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
                        <Text className="text-slate-400 text-[11px] font-bold">{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</Text>
                    </View>

                    <View className="flex-row justify-between items-end mb-3">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Progress</Text>
                        <Text className="text-white text-xl font-black tracking-tight">{completionRate}%</Text>
                    </View>

                    <View className="w-full h-2 bg-slate-950 rounded-full overflow-hidden mb-10">
                        <View className="h-full bg-blue-600 rounded-full" style={{ width: `${completionRate}%` }} />
                    </View>
                </TouchableOpacity>

                <View className="flex-row gap-3">
                    <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                        className="flex-1 h-16 bg-blue-600 rounded-[24px] items-center justify-center shadow-2xl shadow-blue-500/20"
                    >
                        <Text className="text-white font-black text-base">Manage Plan</Text>
                    </TouchableOpacity>
                    {isEditing ? (
                         <TouchableOpacity onPress={onDelete} className="w-16 h-16 bg-red-500/10 rounded-[24px] items-center justify-center border border-red-500/20">
                            <Trash2 size={20} color="#EF4444" />
                        </TouchableOpacity>
                    ) : (
                    <View>
                        {/* Full-screen backdrop to close menu on outside tap */}
                        {showMenu && (
                            <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: -2000,
                                        left: -2000,
                                        right: -2000,
                                        bottom: -2000,
                                        zIndex: 40,
                                    }}
                                />
                            </TouchableWithoutFeedback>
                        )}

                        <AnimatePresence>
                            {showMenu && (
                                <MotiView
                                    from={{ opacity: 0, translateY: 8, scale: 0.92 }}
                                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                                    exit={{ opacity: 0, translateY: 8, scale: 0.92 }}
                                    transition={{ type: 'timing', duration: 180 }}
                                    style={{
                                        position: 'absolute',
                                        bottom: 72,
                                        right: 0,
                                        backgroundColor: '#0F172A',
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        borderRadius: 20,
                                        padding: 8,
                                        width: 160,
                                        zIndex: 50,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: 0.5,
                                        shadowRadius: 24,
                                        elevation: 12,
                                    }}
                                >
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setShowMenu(false);
                                            router.push(`/(coach)/challenges/edit/${challenge.id}`);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: 12,
                                            borderRadius: 12,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Edit2 size={16} color="#3B82F6" />
                                        </View>
                                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Edit</Text>
                                    </TouchableOpacity>
                                    
                                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 8, marginVertical: 4 }} />
                                    
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setShowMenu(false);
                                            onDelete?.();
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: 12,
                                            borderRadius: 12,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={16} color="#EF4444" />
                                        </View>
                                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text>
                                    </TouchableOpacity>
                                </MotiView>
                            )}
                        </AnimatePresence>
                        
                        <TouchableOpacity 
                            onPress={() => setShowMenu(!showMenu)}
                            style={[{
                                width: 64,
                                height: 64,
                                borderRadius: 24,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                zIndex: 51,
                            }, showMenu
                                ? { backgroundColor: '#1E293B', borderColor: 'rgba(59,130,246,0.5)' }
                                : { backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.05)' }
                            ]}
                        >
                            <MoreVertical size={20} color={showMenu ? '#3B82F6' : '#64748B'} />
                        </TouchableOpacity>
                    </View>
                    )}
                </View>
            </MotiView>
        </Swipeable>
    );
};
