import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Users, 
  Plus, 
  TrendingUp, 
  Shield, 
  ArrowLeft,
  ChevronRight,
  Mail,
  Calendar,
  Zap,
  Award
} from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandedAvatar } from '@/components/BrandedAvatar';

const { width } = Dimensions.get('window');

interface SubCoach {
  coach_id: string | null;
  full_name: string;
  email: string;
  client_count: number;
  added_at: string;
  status: 'active' | 'pending';
  invite_token: string | null;
  avatar_url?: string | null;
}

export default function TeamManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const { brand } = useBrand();
  const { primary, secondary } = useBrandColors();
  const theme = useTheme();
  
  const [subCoaches, setSubCoaches] = useState<SubCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);

  useEffect(() => {
    if (coach?.is_parent_coach) {
      loadSubCoaches();
      loadBrandStats();

      const subscription = supabase
        .channel('team-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'coach_hierarchy',
            filter: `parent_coach_id=eq.${coach.id}`
          },
          () => {
            loadSubCoaches();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [coach?.id]);

  const loadSubCoaches = async () => {
    if (!coach?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_sub_coaches', {
        p_parent_coach_id: coach.id,
      });

      if (error) throw error;
      setSubCoaches(data || []);
    } catch (error: any) {
      console.error('[TeamManagement] Error loading sub-coaches:', error);
      Alert.alert('Error', `Failed to load team members: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBrandStats = async () => {
    try {
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand?.id);

      if (error) throw error;
      setTotalClients(count || 0);
    } catch (error) {
      console.error('[TeamManagement] Error loading brand stats:', error);
    }
  };

  const getInviteUrl = (token: string) => {
    return `exp://join-team?invite=${token}`;
  };

  const renderCoachCard = (item: SubCoach, index: number) => (
    <MotiView
      key={item.invite_token || item.coach_id || index}
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: 300 + (index * 100) }}
      className="mb-4"
    >
      <TouchableOpacity
        onPress={() => {
          if (item.status === 'active' && item.coach_id) {
            router.push(`/(coach)/team/${item.coach_id}`);
          } else if (item.status === 'pending' && item.invite_token) {
            Alert.alert(
              'Pending Invite',
              `Email: ${item.email}\n\nInvite Token: ${item.invite_token}`,
              [{ text: 'OK' }]
            );
          }
        }}
        className={`p-6 rounded-[32px] border ${item.status === 'pending' ? 'border-dashed border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-slate-900/40'} flex-row items-center gap-4`}
      >
        <BrandedAvatar 
          name={item.full_name}
          size={56}
          imageUrl={item.avatar_url}
          useBrandColor={item.status === 'active'}
        />
        
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-white font-black text-lg tracking-tight" numberOfLines={1}>
              {item.full_name}
            </Text>
            {item.status === 'pending' ? (
              <View className="bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                <Text className="text-amber-500 text-[8px] font-black uppercase tracking-widest">Pending</Text>
              </View>
            ) : (
              <View className="bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                <Text className="text-emerald-500 text-[8px] font-black uppercase tracking-widest">Active</Text>
              </View>
            )}
          </View>
          
          <Text className="text-slate-500 text-xs font-medium mb-3" numberOfLines={1}>
            {item.email}
          </Text>
          
          <View className="flex-row items-center gap-4">
             <View className="flex-row items-center gap-1.5">
                <Users size={12} color="#94A3B8" />
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{item.client_count} Clients</Text>
             </View>
             <View className="w-1 h-1 rounded-full bg-slate-800" />
             <View className="flex-row items-center gap-1.5">
                <Calendar size={12} color="#94A3B8" />
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  {new Date(item.added_at).toLocaleDateString()}
                </Text>
             </View>
          </View>
        </View>
        
        <ChevronRight size={20} color="#334155" />
      </TouchableOpacity>
    </MotiView>
  );

  if (!coach?.is_parent_coach) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center p-8">
        <Award size={64} color="#1E293B" />
        <Text className="text-white text-2xl font-black text-center mt-6 tracking-tighter">Parent Coach Only</Text>
        <Text className="text-slate-500 text-center mt-3 leading-5 font-medium">
          This feature is reserved for head coaches managing strategic performance teams.
        </Text>
        <TouchableOpacity 
           onPress={() => router.back()}
           className="mt-8 px-8 py-4 bg-slate-900 rounded-2xl border border-white/5"
        >
            <Text className="text-white font-black uppercase tracking-widest text-xs">Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View 
        style={{ paddingTop: insets.top + 16 }} 
        className="px-6 pb-6 flex-row items-center justify-between border-b border-white/5 bg-slate-950"
      >
        <View className="flex-row items-center gap-4">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-2 bg-slate-900 rounded-full border border-white/5"
            >
              <ArrowLeft size={20} color="#94A3B8" />
            </TouchableOpacity>
            <View>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px]">Growth Center</Text>
                <Text className="text-white text-xl font-black tracking-tight">Team Management</Text>
            </View>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.push('/(coach)/team/add')}
          className="w-12 h-12 bg-blue-600 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/30 border border-white/10"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={(e) => {
            // Placeholder for potential scroll interactions
        }}
      >
        {/* Banner Hero */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mx-6 mt-8 p-10 rounded-[48px] bg-blue-600/10 border border-blue-500/20 items-center overflow-hidden"
        >
            <View className="absolute top-0 right-0 p-4 opacity-10">
                <Shield size={120} color="#3B82F6" />
            </View>
            <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-500/50 mb-6 border-2 border-white/20">
                <Users size={36} color="white" fill="white" />
            </View>
            <Text className="text-white text-2xl font-black text-center tracking-tighter">Command Center</Text>
            <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                Oversee your sub-coaches, track performance metrics, and optimize your organization's coaching output.
            </Text>
        </MotiView>

        {/* Stats Grid */}
        <MotiView
           from={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 100 }}
           className="mx-6 mt-8 p-8 rounded-[40px] bg-slate-900/40 border border-white/5"
        >
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-slate-950 items-center justify-center border border-white/5">
                    <TrendingUp size={16} color="#3B82F6" />
                </View>
                <Text className="text-white font-black text-lg tracking-tight">{brand?.name || 'Network Stats'}</Text>
            </View>
            <View className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <Text className="text-emerald-500 text-[8px] font-black uppercase tracking-widest">Optimized</Text>
            </View>
          </View>
          
          <View className="flex-row">
            <StatItem 
                label="Coaches" 
                value={subCoaches.length.toString()} 
                icon={<Users size={14} color="#3B82F6" />}
            />
            <View className="w-px h-12 bg-white/5 mx-2 self-center" />
            <StatItem 
                label="Total Depth" 
                value={totalClients.toString()} 
                icon={<Zap size={14} color="#10B981" />}
            />
            <View className="w-px h-12 bg-white/5 mx-2 self-center" />
            <StatItem 
                label="Assigned" 
                value={subCoaches.reduce((sum, coach) => sum + coach.client_count, 0).toString()} 
                icon={<Shield size={14} color="#F59E0B" />}
                isLast
            />
          </View>
        </MotiView>

        {/* Team Members List */}
        <View className="px-6 mt-10">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-black tracking-tighter">Team Roster</Text>
            <Text className="text-slate-500 text-xs font-black uppercase tracking-widest">{subCoaches.length} Members</Text>
          </View>

          {loading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator color="#3B82F6" />
              <Text className="text-slate-500 mt-4 font-bold tracking-widest text-[10px] uppercase">Syncing Neural Data...</Text>
            </View>
          ) : subCoaches.length === 0 ? (
            <MotiView 
               from={{ opacity: 0 }} 
               animate={{ opacity: 1 }}
               className="py-16 items-center justify-center bg-slate-900/20 rounded-[40px] border border-white/5 border-dashed"
            >
              <Users size={48} color="#1E293B" />
              <Text className="text-slate-400 font-bold mt-4">No roster found</Text>
              <TouchableOpacity 
                onPress={() => router.push('/(coach)/team/add')}
                className="mt-6 px-6 py-3 bg-blue-600 rounded-xl"
              >
                <Text className="text-white font-black text-xs uppercase tracking-widest">Add First Coach</Text>
              </TouchableOpacity>
            </MotiView>
          ) : (
            subCoaches.map((item, index) => renderCoachCard(item, index))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const StatItem = ({ label, value, icon, isLast }: any) => (
    <View className={`flex-1 items-center ${isLast ? '' : 'border-r border-white/5'}`}>
        <View className="flex-row items-center gap-1.5 mb-1">
            {icon}
            <Text className="text-slate-500 text-[8px] font-black uppercase tracking-[2px]">{label}</Text>
        </View>
        <Text className="text-white text-2xl font-black tracking-tighter">{value}</Text>
    </View>
);
