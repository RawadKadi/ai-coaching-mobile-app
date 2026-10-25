import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Target,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Calendar as CalendarIcon,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MagicRings from '@/components/ui/MagicRings';

export default function ClientChallengesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'history'>('active');
  const [motherChallenges, setMotherChallenges] = useState<any[]>([]);

  useEffect(() => {
    loadChallenges();
  }, [user]);

  const loadChallenges = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!clientData) return;

      const [activeResult, completedResult, failedResult] = await Promise.all([
        supabase.rpc('get_client_mother_challenges', {
          p_client_id: clientData.id,
          p_status: 'active',
        }),
        supabase.rpc('get_client_mother_challenges', {
          p_client_id: clientData.id,
          p_status: 'completed',
        }),
        supabase.rpc('get_client_mother_challenges', {
          p_client_id: clientData.id,
          p_status: 'failed',
        }),
      ]);

      const combined = [
        ...(activeResult?.data || []),
        ...(completedResult?.data || []),
        ...(failedResult?.data || []),
      ].sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      );

      setMotherChallenges(combined);
    } catch (e) {
      console.error('Error loading challenges:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const todayMidnight = new Date(new Date().setHours(0, 0, 0, 0));

  const filteredChallenges = motherChallenges.filter((c) => {
    const isEnded =
      c.status !== 'active' || new Date(c.end_date) < todayMidnight;
    if (activeTab === 'active') return !isEnded;
    if (activeTab === 'history') return isEnded;
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 20,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              backgroundColor: cardBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cardBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}
          >
            <ArrowLeft size={20} color={textColor} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: textColor, fontSize: 24, fontWeight: '900' }}>
              Challenges
            </Text>
            <Text
              style={{
                color: theme.colors.primary,
                fontWeight: 'bold',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 2,
                marginTop: 2,
              }}
            >
              Active & History
            </Text>
          </View>
        </View>

        {/* Tab Filters */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 24,
            gap: 16,
            marginBottom: 20,
          }}
        >
          {(['all', 'active', 'history'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: isSelected
                    ? `${theme.colors.primary}20`
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: isSelected
                    ? `${theme.colors.primary}50`
                    : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    color: isSelected
                      ? theme.colors.primary
                      : textSecondaryColor,
                  }}
                >
                  {tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'History'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
          >
            {filteredChallenges.length === 0 ? (
              <View
                style={{
                  padding: 48,
                  backgroundColor: cardBg,
                  borderRadius: 32,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  alignItems: 'center',
                  marginTop: 20,
                }}
              >
                <Target size={44} color={textSecondaryColor} />
                <Text
                  style={{
                    color: textSecondaryColor,
                    fontWeight: 'bold',
                    marginTop: 16,
                    fontSize: 14,
                  }}
                >
                  {activeTab === 'active'
                    ? 'No active challenges'
                    : activeTab === 'history'
                      ? 'No challenge history'
                      : 'No challenges found'}
                </Text>
              </View>
            ) : (
              filteredChallenges.map((motherChallenge) => {
                const isEnded =
                  motherChallenge.status !== 'active' ||
                  new Date(motherChallenge.end_date) < todayMidnight;
                const isFailed =
                  isEnded && (motherChallenge.completed_subs || 0) === 0;
                const isCompleted =
                  isEnded && (motherChallenge.completed_subs || 0) > 0;

                const currentDay = Math.max(
                  1,
                  Math.floor(
                    (new Date().getTime() -
                      new Date(motherChallenge.start_date).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ) + 1,
                );

                const progressPercent = Math.round(
                  ((motherChallenge.completed_subs || 0) /
                    Math.max(1, motherChallenge.total_subs || 1)) *
                    100,
                );

                return (
                  <View key={motherChallenge.id} style={{ marginBottom: 16 }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push(
                          `/(client)/challenges/${motherChallenge.id}` as any,
                        )
                      }
                      style={{
                        backgroundColor: cardBg,
                        borderRadius: 32,
                        padding: 24,
                        borderWidth: 1,
                        borderColor: isFailed
                          ? '#ef444450'
                          : isCompleted
                            ? '#10b98150'
                            : cardBorder,
                        opacity: isFailed || isCompleted ? 0.65 : 1,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Magic Rings background only for active challenges */}
                      {!isFailed && !isCompleted && (
                        <View
                          style={{
                            ...(StyleSheet.absoluteFill as any),
                            opacity: isDark ? 0.25 : 0.12,
                          }}
                          pointerEvents="none"
                        >
                          <MagicRings
                            color={isDark ? '#3B82F6' : '#60a5fa'}
                            colorTwo={isDark ? '#1d4ed8' : '#3b82f6'}
                            backgroundColor={cardBg}
                            ringCount={5}
                            speed={0.6}
                            attenuation={9}
                            lineThickness={2}
                            baseRadius={0.32}
                            radiusStep={0.12}
                            followMouse={false}
                            clickBurst={false}
                          />
                        </View>
                      )}

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 16,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {isFailed ? (
                            <>
                              <X size={16} color="#EF4444" />
                              <Text
                                style={{
                                  color: '#EF4444',
                                  fontSize: 10,
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: 2,
                                }}
                              >
                                Failed Plan
                              </Text>
                            </>
                          ) : isCompleted ? (
                            <>
                              <CheckCircle size={16} color="#10B981" />
                              <Text
                                style={{
                                  color: '#10B981',
                                  fontSize: 10,
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: 2,
                                }}
                              >
                                Finished
                              </Text>
                            </>
                          ) : (
                            <>
                              <Target size={16} color={theme.colors.primary} />
                              <Text
                                style={{
                                  color: theme.colors.primary,
                                  fontSize: 10,
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: 2,
                                }}
                              >
                                Active Challenge
                              </Text>
                            </>
                          )}
                        </View>
                        <ChevronRight size={16} color={textSecondaryColor} />
                      </View>

                      <Text
                        style={{
                          color: textColor,
                          fontSize: 20,
                          fontWeight: '900',
                          marginBottom: 12,
                        }}
                      >
                        🔥 {motherChallenge.name}
                      </Text>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginBottom: 20,
                          gap: 6,
                        }}
                      >
                        <CalendarIcon size={14} color={textSecondaryColor} />
                        <Text
                          style={{
                            color: textSecondaryColor,
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          Day {currentDay} of {motherChallenge.duration_days} •{' '}
                          {motherChallenge.total_subs} Total Tasks
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
                          borderColor: cardBorder,
                        }}
                      >
                        <View
                          style={{
                            height: '100%',
                            width: `${Math.min(100, progressPercent)}%`,
                            backgroundColor: theme.colors.primary,
                            borderRadius: 6,
                          }}
                        />
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Text
                          style={{
                            color: textColor,
                            fontSize: 12,
                            fontWeight: '900',
                          }}
                        >
                          {progressPercent}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
