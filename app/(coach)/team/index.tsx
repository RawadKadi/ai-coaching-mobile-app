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
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { safeBack } from '@/lib/navigation-utils';

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
  const colors = useBrandColors();
  const isDarkMode = isDarkColor(colors.background || '#010417');
  
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
        style={{
          backgroundColor: item.status === 'pending' 
            ? (isDarkMode ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB')
            : colors.surface,
          borderColor: item.status === 'pending'
            ? (isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A')
            : colors.border,
        }}
        className="p-5 rounded-[28px] border flex-row items-center gap-4 shadow-sm"
        activeOpacity={0.7}
      >
        <BrandedAvatar 
          name={item.full_name}
          size={52}
          imageUrl={item.avatar_url}
          useBrandColor={item.status === 'active'}
        />
        
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text style={{ color: colors.text }} className="font-black text-base tracking-tight" numberOfLines={1}>
              {item.full_name}
            </Text>
            {item.status === 'pending' ? (
              <View className="bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                <Text className="text-amber-500 text-[9px] font-black uppercase tracking-widest">Pending</Text>
              </View>
            ) : (
              <View className="bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                <Text className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Active</Text>
              </View>
            )}
          </View>
          
          <Text style={{ color: colors.textSecondary }} className="text-xs font-medium mb-2.5" numberOfLines={1}>
            {item.email}
          </Text>
          
          <View className="flex-row items-center gap-3">
             <View className="flex-row items-center gap-1.5">
                <Users size={12} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider">
                  {item.client_count} Clients
                </Text>
             </View>
             <View style={{ backgroundColor: colors.border }} className="w-1 h-1 rounded-full" />
             <View className="flex-row items-center gap-1.5">
                <Calendar size={12} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider">
                  {new Date(item.added_at).toLocaleDateString()}
                </Text>
             </View>
          </View>
        </View>
        
        <ChevronRight size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </MotiView>
  );

  if (!coach?.is_parent_coach) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} className="items-center justify-center p-8">
        <Award size={64} color={colors.textTertiary} />
        <Text style={{ color: colors.text }} className="text-2xl font-black text-center mt-6 tracking-tight">
          Parent Coach Only
        </Text>
        <Text style={{ color: colors.textSecondary }} className="text-center mt-3 leading-5 font-medium">
          This feature is for head coaches managing a coaching team.
        </Text>
        <TouchableOpacity 
           onPress={() => safeBack('/(coach)/(tabs)/profile')}
           style={{ backgroundColor: colors.surface, borderColor: colors.border }}
           className="mt-8 px-8 py-4 rounded-2xl border"
        >
            <Text style={{ color: colors.text }} className="font-black uppercase tracking-widest text-xs">
              Back to Profile
            </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View 
        style={{ 
          paddingTop: insets.top + 16,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        }} 
        className="px-6 pb-6 flex-row items-center justify-between border-b"
      >
        <View className="flex-row items-center gap-4">
          <TouchableOpacity 
            onPress={() => safeBack('/(coach)/(tabs)/profile')} 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="p-2.5 rounded-full border"
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: colors.textSecondary }} className="text-[10px] font-black uppercase tracking-[3px]">
              Team
            </Text>
            <Text style={{ color: colors.text }} className="text-xl font-black tracking-tight">
              Team Members
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.push('/(coach)/team/add')}
          style={{ backgroundColor: colors.primary }}
          className="w-12 h-12 rounded-2xl items-center justify-center shadow-lg"
          activeOpacity={0.85}
        >
          <Plus size={22} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Banner Hero */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="mx-6 mt-8 p-8 rounded-[40px] border items-center overflow-hidden shadow-sm"
        >
          <View className="absolute top-0 right-0 p-4 opacity-10">
            <Shield size={120} color={colors.primary} />
          </View>
          <View 
            style={{ backgroundColor: colors.primary }}
            className="w-16 h-16 rounded-[24px] items-center justify-center mb-5 shadow-lg"
          >
            <Users size={30} color={colors.textOnPrimary} fill={colors.textOnPrimary} />
          </View>
          <Text style={{ color: colors.text }} className="text-2xl font-black text-center tracking-tight">
            Team Overview
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-center mt-2.5 leading-5 px-4 text-sm font-medium">
            Manage your coaches and monitor client coverage.
          </Text>
        </MotiView>

        {/* Stats Grid */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 100 }}
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="mx-6 mt-6 p-6 rounded-[32px] border shadow-sm"
        >
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row items-center gap-2.5">
              <View 
                style={{ backgroundColor: colors.background, borderColor: colors.border }}
                className="w-8 h-8 rounded-xl items-center justify-center border"
              >
                <TrendingUp size={16} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text }} className="font-black text-base tracking-tight">
                {brand?.name || 'Team Stats'}
              </Text>
            </View>
            <View className="px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <Text className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Active</Text>
            </View>
          </View>
          
          <View className="flex-row">
            <StatItem 
              label="Coaches" 
              value={subCoaches.length.toString()} 
              icon={<Users size={14} color={colors.primary} />}
              colors={colors}
            />
            <View style={{ backgroundColor: colors.border }} className="w-px h-10 mx-2 self-center" />
            <StatItem 
              label="Clients" 
              value={totalClients.toString()} 
              icon={<Zap size={14} color="#10B981" />}
              colors={colors}
            />
            <View style={{ backgroundColor: colors.border }} className="w-px h-10 mx-2 self-center" />
            <StatItem 
              label="Assigned" 
              value={subCoaches.reduce((sum, coach) => sum + coach.client_count, 0).toString()} 
              icon={<Shield size={14} color="#F59E0B" />}
              isLast
              colors={colors}
            />
          </View>
        </MotiView>

        {/* Team Members List */}
        <View className="px-6 mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text style={{ color: colors.text }} className="text-lg font-black tracking-tight">
              Team Coaches
            </Text>
            <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase tracking-wider">
              {subCoaches.length} {subCoaches.length === 1 ? 'Coach' : 'Coaches'}
            </Text>
          </View>

          {loading ? (
            <View className="py-16 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary }} className="mt-3 font-bold tracking-wider text-xs">
                Loading team...
              </Text>
            </View>
          ) : subCoaches.length === 0 ? (
            <MotiView 
              from={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="py-14 px-6 items-center justify-center rounded-[32px] border border-dashed"
            >
              <Users size={40} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary }} className="font-bold mt-3 text-sm">
                No coaches added yet
              </Text>
              <TouchableOpacity 
                onPress={() => router.push('/(coach)/team/add')}
                style={{ backgroundColor: colors.primary }}
                className="mt-5 px-6 py-3 rounded-xl shadow-sm"
              >
                <Text style={{ color: colors.textOnPrimary }} className="font-black text-xs uppercase tracking-wider">
                  Add First Coach
                </Text>
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

const StatItem = ({ label, value, icon, isLast, colors }: any) => (
  <View className={`flex-1 items-center ${isLast ? '' : ''}`}>
    <View className="flex-row items-center gap-1.5 mb-1">
      {icon}
      <Text style={{ color: colors.textSecondary }} className="text-[9px] font-black uppercase tracking-[1px]">{label}</Text>
    </View>
    <Text style={{ color: colors.text }} className="text-2xl font-black tracking-tight">{value}</Text>
  </View>
);
