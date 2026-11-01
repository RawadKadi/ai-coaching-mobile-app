import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  LayoutAnimation,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  Award,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Target,
  X,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { BrandedButton } from '@/components/BrandedButton';
import CoachSubpageHeader from '@/components/CoachSubpageHeader';
import { ChallengeListSkeleton } from '@/components/ChallengeListSkeleton';

type Tab = 'active' | 'history';

export default function CoachClientChallengesScreen() {
  const router = useRouter();
  const { clientId, name, avatar } = useLocalSearchParams<{ clientId: string; name?: string; avatar?: string }>();
  const { coach } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const reduceMotion = useReducedMotion();
  const isDark = isDarkColor(colors.background || '#020617');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [clientAvatar, setClientAvatar] = useState<string | null>(avatar || null);
  const [tab, setTab] = useState<Tab>('active');
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (!coach?.id || !clientId) return;
    try {
      if (!hasLoaded.current) setLoading(true);
      const [challengesRes, clientRes] = await Promise.all([
        supabase.rpc('get_coach_mother_challenges', {
          p_coach_id: coach.id,
          p_client_id: clientId,
        }),
        !clientAvatar
          ? supabase.rpc('get_client_details', { target_client_id: clientId })
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (challengesRes.error) throw challengesRes.error;
      const sorted = [...(challengesRes.data || [])].sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      );
      setChallenges(sorted);
      if (clientRes?.data?.profiles?.avatar_url) {
        setClientAvatar(clientRes.data.profiles.avatar_url);
      } else if (sorted.length > 0 && sorted[0].client_avatar) {
        setClientAvatar(sorted[0].client_avatar);
      }
      hasLoaded.current = true;
    } catch (e) {
      console.error('Error loading challenges:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coach?.id, clientId, clientAvatar]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const todayMidnight = new Date(new Date().setHours(0, 0, 0, 0));
  const isEnded = (c: any) =>
    c.status !== 'active' || new Date(c.end_date) < todayMidnight;

  const activeList = challenges.filter((c) => !isEnded(c));
  const historyList = challenges.filter((c) => isEnded(c));
  const list = tab === 'active' ? activeList : historyList;

  const handleDelete = (challenge: any) => {
    Alert.alert('Delete challenge?', 'This removes the challenge and all progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('mother_challenges')
              .delete()
              .eq('id', challenge.id);
            if (error) throw error;
            if (!reduceMotion) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            }
            setChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const openOptions = (challenge: any) => {
    Alert.alert(challenge.name, undefined, [
      {
        text: 'Edit',
        onPress: () => router.push(`/(coach)/challenges/edit/${challenge.id}` as any),
      },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(challenge) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openCreate = () => {
    Alert.alert('New challenge', 'How do you want to start?', [
      {
        text: 'Custom',
        onPress: () => router.push(`/(coach)/challenges/create?clientId=${clientId}` as any),
      },
      {
        text: 'Use AI',
        onPress: () => router.push(`/(coach)/clients/ai-selection?clientId=${clientId}` as any),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <CoachSubpageHeader
        title="Challenges"
        subtitle={name}
        clientName={name}
        avatarUrl={clientAvatar}
        right={
          <BrandedButton
            title="New"
            onPress={openCreate}
            icon={<Plus size={16} color={colors.textOnPrimary || 'white'} strokeWidth={3} />}
            style={{ paddingVertical: 10, paddingHorizontal: 16 }}
            textStyle={{ fontSize: 13, fontWeight: '700' }}
          />
        }
      />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 8, paddingVertical: 16 }}>
        {(['active', 'history'] as const).map((t) => {
          const selected = tab === t;
          const count = t === 'active' ? activeList.length : historyList.length;
          return (
            <TouchableOpacity
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              activeOpacity={0.7}
              onPress={() => setTab(t)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: selected ? `${colors.primary}20` : 'transparent',
                borderColor: selected ? `${colors.primary}50` : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: selected ? colors.primary : colors.textSecondary,
                }}
              >
                {t === 'active' ? 'Active' : 'History'}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: selected ? colors.primary : colors.textSecondary,
                }}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 64 }}>
          <ChallengeListSkeleton count={3} />
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 64 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {list.length === 0 ? (
            <View
              style={{
                padding: 40,
                backgroundColor: colors.surface,
                borderRadius: 32,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  backgroundColor: `${colors.primary}18`,
                  borderColor: `${colors.primary}35`,
                  marginBottom: 16,
                }}
              >
                <Award size={24} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>
                {tab === 'active' ? 'No active challenges' : 'No history yet'}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                {tab === 'active'
                  ? 'Tap New to start one.'
                  : 'Finished challenges show up here.'}
              </Text>
            </View>
          ) : (
            list.map((c, index) => {
              const ended = isEnded(c);
              const completedSubs = Number(c.completed_subs || 0);
              const totalSubs = Number(c.total_subs || 0);
              const failed = ended && completedSubs === 0;
              const finished = ended && completedSubs > 0;
              const progress = Math.min(
                100,
                Math.round((completedSubs / Math.max(1, totalSubs)) * 100),
              );
              const totalDays =
                Number(c.duration_days) ||
                Math.max(
                  1,
                  Math.ceil(
                    (new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) /
                      86400000,
                  ),
                );
              const currentDay = Math.min(
                totalDays,
                Math.max(
                  1,
                  Math.floor((Date.now() - new Date(c.start_date).getTime()) / 86400000) + 1,
                ),
              );

              const statusColor = failed ? '#EF4444' : finished ? '#10B981' : colors.primary;
              const statusLabel = failed ? 'Failed' : finished ? 'Finished' : 'Active';
              const StatusIcon = failed ? X : finished ? CheckCircle : Target;

              return (
                <MotiView
                  key={c.id}
                  from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 12 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                  transition={{ delay: reduceMotion ? 0 : index * 60 }}
                  style={{ marginBottom: 16 }}
                >
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}, ${statusLabel}, ${progress}%`}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/(coach)/challenges/${c.id}` as any)}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 32,
                      padding: 24,
                      borderWidth: 1,
                      borderColor: failed
                        ? '#EF444450'
                        : finished
                          ? '#10B98150'
                          : colors.border,
                      opacity: failed || finished ? 0.75 : 1,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <StatusIcon size={16} color={statusColor} />
                        <Text
                          style={{
                            color: statusColor,
                            fontSize: 10,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                          }}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                      {ended ? (
                        <ChevronRight size={16} color={colors.textSecondary} />
                      ) : (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="More options"
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          activeOpacity={0.6}
                          onPress={() => openOptions(c)}
                        >
                          <MoreHorizontal size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 20,
                        fontWeight: '900',
                        marginBottom: 8,
                      }}
                    >
                      {c.name}
                    </Text>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 24,
                      }}
                    >
                      <CalendarIcon size={14} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        {ended ? `${totalDays} days` : `Day ${currentDay} of ${totalDays}`} •{' '}
                        {totalSubs} tasks
                      </Text>
                    </View>

                    <View
                      style={{
                        height: 12,
                        backgroundColor: colors.background,
                        borderRadius: 6,
                        overflow: 'hidden',
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          backgroundColor: failed ? '#EF4444' : colors.primary,
                          borderRadius: 6,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '900' }}>
                        {progress}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
