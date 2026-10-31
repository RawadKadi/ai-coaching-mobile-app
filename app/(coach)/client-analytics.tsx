import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import {
  ArrowLeft,
  Search,
  ChevronRight,
  BarChart2,
  TrendingUp,
  Users,
  Activity,
  Flame,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { ClientCardsSkeleton } from '@/components/ClientCardsSkeleton';
import { safeBack } from '@/lib/navigation-utils';

interface ClientItem {
  client_id: string;
  client_name: string;
  client_avatar?: string | null;
  client_goal?: string | null;
  status?: string | null;
}

export default function ClientAnalyticsPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors, isDarkMode } = theme;
  const { coach } = useAuth();

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadClients();
  }, [coach?.id]);

  const loadClients = async () => {
    if (!coach?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_my_clients');
      if (error) throw error;
      setClients(data || []);
    } catch (e) {
      console.error('[ClientAnalyticsPicker] Load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.client_name?.toLowerCase().includes(q) ||
        c.client_goal?.toLowerCase().includes(q),
    );
  }, [clients, searchQuery]);

  const activeCount = useMemo(() => {
    return clients.filter((c) => c.status === 'active' || !c.status).length;
  }, [clients]);

  const withGoalsCount = useMemo(() => {
    return clients.filter((c) => Boolean(c.client_goal)).length;
  }, [clients]);

  const handleSelectClient = (clientId: string) => {
    router.push({
      pathname: '/(client)/analytics',
      params: { clientId },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
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
            onPress={() => safeBack()}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
            className="p-2.5 rounded-full border"
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text
              style={{ color: colors.primary }}
              className="text-[10px] font-black uppercase tracking-[3px] mb-0.5"
            >
              ANALYTICS CENTER
            </Text>
            <Text
              style={{ color: colors.text }}
              className="text-2xl font-black tracking-tight"
            >
              Client Analytics
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 32, 48),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadClients();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="mx-6 mt-6 p-8 rounded-[40px] border items-center overflow-hidden"
        >
          <View className="absolute top-0 right-0 p-4 opacity-10">
            <BarChart2 size={120} color={colors.primary} />
          </View>
          <View
            style={{ backgroundColor: colors.primary }}
            className="w-20 h-20 rounded-[30px] items-center justify-center shadow-2xl mb-5 border-2 border-white/20"
          >
            <BarChart2 size={36} color={colors.textOnPrimary} />
          </View>
          <Text
            style={{ color: colors.text }}
            className="text-2xl font-black text-center tracking-tighter"
          >
            Nutrition & Progress
          </Text>
          <Text
            style={{ color: colors.textSecondary }}
            className="text-center mt-2 leading-5 px-4 text-sm font-medium"
          >
            Check client calories, macros, steps, and daily habits.
          </Text>
        </View>

        {/* Quick Stats Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="mx-6 mt-6 p-6 rounded-[32px] border"
        >
          <View className="flex-row items-center gap-2 mb-6">
            <View
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
              className="w-8 h-8 rounded-xl items-center justify-center border"
            >
              <TrendingUp size={16} color={colors.primary} />
            </View>
            <Text
              style={{ color: colors.text }}
              className="font-black text-base tracking-tight"
            >
              Active Overview
            </Text>
          </View>

          <View className="flex-row">
            <View className="flex-1 items-center">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Users size={13} color={colors.primary} />
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-[9px] font-black uppercase tracking-[2px]"
                >
                  Clients
                </Text>
              </View>
              <Text
                style={{ color: colors.text }}
                className="text-2xl font-black tracking-tighter"
              >
                {clients.length}
              </Text>
            </View>

            <View
              style={{ backgroundColor: colors.border }}
              className="w-px h-10 mx-2 self-center"
            />

            <View className="flex-1 items-center">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Activity size={13} color="#10B981" />
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-[9px] font-black uppercase tracking-[2px]"
                >
                  Active
                </Text>
              </View>
              <Text
                style={{ color: colors.text }}
                className="text-2xl font-black tracking-tighter"
              >
                {activeCount}
              </Text>
            </View>

            <View
              style={{ backgroundColor: colors.border }}
              className="w-px h-10 mx-2 self-center"
            />

            <View className="flex-1 items-center">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Flame size={13} color="#F59E0B" />
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-[9px] font-black uppercase tracking-[2px]"
                >
                  Goals
                </Text>
              </View>
              <Text
                style={{ color: colors.text }}
                className="text-2xl font-black tracking-tighter"
              >
                {withGoalsCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="px-6 mt-8 mb-6 flex-row gap-3">
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
            className="flex-1 flex-row items-center border rounded-[28px] px-6 py-4"
          >
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              style={{ color: colors.text }}
              className="flex-1 ml-4 font-bold text-base"
              placeholder="Search clients..."
              placeholderTextColor={colors.textTertiary || colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Client Cards List */}
        <View className="px-6">
          {loading ? (
            <ClientCardsSkeleton count={3} />
          ) : filteredClients.length === 0 ? (
            <View className="py-20 items-center">
              <BarChart2 size={48} color={colors.border} />
              <Text
                style={{ color: colors.textSecondary }}
                className="font-bold mt-4"
              >
                {searchQuery ? 'No clients found' : 'No clients yet'}
              </Text>
            </View>
          ) : (
            filteredClients.map((item, i) => (
              <MotiView
                key={item.client_id}
                from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: reduceMotion ? 0 : i * 50 }}
                className="mb-4"
              >
                <TouchableOpacity
                  onPress={() => handleSelectClient(item.client_id)}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                  className="p-6 rounded-[40px] border flex-row items-center justify-between shadow-sm"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-5 flex-1">
                    <View className="relative">
                      <BrandedAvatar
                        size={60}
                        name={item.client_name || 'Client'}
                        imageUrl={item.client_avatar}
                        useBrandColor={true}
                      />
                      <View
                        className={`absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full border-[3px] border-slate-900 ${
                          item.status === 'active' || !item.status
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ color: colors.text }}
                        className="font-black text-lg tracking-tight"
                        numberOfLines={1}
                      >
                        {item.client_name}
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary }}
                        className="text-[10px] font-black uppercase tracking-[2px] mt-1"
                        numberOfLines={1}
                      >
                        {item.client_goal || 'Health & Fitness'}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </MotiView>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
