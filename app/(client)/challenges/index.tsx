import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Target,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Calendar as CalendarIcon,
  X,
  Award,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MagicRings from '@/components/ui/MagicRings';
import Svg, { Path } from 'react-native-svg';
import { MotiView } from 'moti';
import BlurText from '@/components/ui/BlurText';

/** Generates an SVG path with a rounded rectangle cutout using fillRule="evenodd". */
function getSpotlightPath(
  screenW: number,
  screenH: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const safeW = Math.max(1, w);
  const safeH = Math.max(1, h);
  const maxR = Math.min(safeW / 2, safeH / 2);
  const radius = Math.max(0, Math.min(r, maxR));

  return (
    `M -20 -20 ` +
    `H ${screenW + 40} ` +
    `V ${screenH + 40} ` +
    `H -20 ` +
    `Z ` +
    `M ${x + radius} ${y} ` +
    `H ${x + safeW - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + safeW} ${y + radius} ` +
    `V ${y + safeH - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + safeW - radius} ${y + safeH} ` +
    `H ${x + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x} ${y + safeH - radius} ` +
    `V ${y + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y} ` +
    `Z`
  );
}

export default function ClientChallengesScreen() {
  const router = useRouter();
  const { highlightChallenges } = useLocalSearchParams<{
    highlightChallenges?: string;
  }>();
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
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [motherChallenges, setMotherChallenges] = useState<any[]>([]);

  // Spotlight highlight state
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightLayout, setHighlightLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [showTooltipCard, setShowTooltipCard] = useState(false);
  const tooltipTimerRef = useRef<any>(null);
  const hasTriggeredHighlight = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const challengeItemRef = useRef<View>(null);

  useEffect(() => {
    loadChallenges();
  }, [user]);

  const triggerChallengesHighlight = () => {
    setActiveTab('active');
    setShowTooltipCard(false);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });

      setTimeout(() => {
        challengeItemRef.current?.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            const screenW = Dimensions.get('window').width;
            if (width > 0 && height > 0) {
              setHighlightLayout({
                x: Math.max(8, x - 8),
                y: Math.max(insets.top + 10, y - 8),
                width: width + 16,
                height: height + 16,
              });
            } else {
              setHighlightLayout({
                x: 16,
                y: insets.top + 120,
                width: screenW - 32,
                height: 220,
              });
            }
            setIsHighlighting(true);

            tooltipTimerRef.current = setTimeout(() => {
              setShowTooltipCard(true);
            }, 380);
          },
        );
      }, 450);
    }, 200);
  };

  useEffect(() => {
    if (highlightChallenges === 'true' && !loading) {
      if (hasTriggeredHighlight.current) return;
      hasTriggeredHighlight.current = true;
      triggerChallengesHighlight();
    } else if (highlightChallenges !== 'true') {
      hasTriggeredHighlight.current = false;
    }
  }, [highlightChallenges, loading, insets.top]);

  useFocusEffect(
    useCallback(() => {
      if (highlightChallenges === 'true' && !loading) {
        hasTriggeredHighlight.current = true;
        triggerChallengesHighlight();
      }
    }, [highlightChallenges, loading])
  );

  const handleDismissHighlight = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setShowTooltipCard(false);
    setIsHighlighting(false);
    hasTriggeredHighlight.current = false;
    router.setParams({ highlightChallenges: '' });
  };

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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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
            paddingHorizontal: 12,
            gap: 12,
            marginBottom: 16,
          }}
        >
          {(['active', 'history'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
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
                  {tab === 'active' ? 'Active' : 'History'}
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
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 60 }}
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
                ref={challengeItemRef}
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
                    : 'No challenge history'}
                </Text>
              </View>
            ) : (
              filteredChallenges.map((motherChallenge, index) => {
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
                  <View
                    key={motherChallenge.id}
                    ref={index === 0 ? challengeItemRef : undefined}
                    style={{ marginBottom: 16 }}
                  >
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

      {/* Spotlight Highlight Overlay */}
      {isHighlighting && highlightLayout && (
        <Modal
          visible={isHighlighting}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={handleDismissHighlight}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Dimmed Background Overlay with Cutout */}
            <TouchableWithoutFeedback onPress={handleDismissHighlight}>
              <View style={StyleSheet.absoluteFill}>
                <Svg
                  width={Dimensions.get('window').width}
                  height={Dimensions.get('window').height}
                  style={StyleSheet.absoluteFill}
                >
                  <Path
                    d={getSpotlightPath(
                      Dimensions.get('window').width,
                      Dimensions.get('window').height,
                      highlightLayout.x,
                      highlightLayout.y,
                      highlightLayout.width,
                      highlightLayout.height,
                      36,
                    )}
                    fill={
                      isDark
                        ? 'rgba(2, 6, 23, 0.85)'
                        : 'rgba(15, 23, 42, 0.72)'
                    }
                    fillRule="evenodd"
                  />
                </Svg>
              </View>
            </TouchableWithoutFeedback>

            {/* Glowing Border Box surrounding the Challenge Card */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: highlightLayout.y,
                left: highlightLayout.x,
                width: highlightLayout.width,
                height: highlightLayout.height,
                borderRadius: 36,
                borderWidth: 2.5,
                borderColor: theme.colors.primary,
                shadowColor: theme.colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 18,
                elevation: 12,
              }}
            />

            {/* Floating Tooltip Card */}
            {showTooltipCard && (
              <MotiView
                from={{ opacity: 0, translateY: 16, scale: 0.95 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={
                  { type: 'spring', damping: 18, stiffness: 140 } as any
                }
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  top:
                    highlightLayout.y + highlightLayout.height + 180 >
                    Dimensions.get('window').height - insets.bottom
                      ? Math.max(insets.top + 16, highlightLayout.y - 190)
                      : highlightLayout.y + highlightLayout.height + 16,
                  backgroundColor: cardBg,
                  borderRadius: 28,
                  padding: 22,
                  borderWidth: 1.5,
                  borderColor: colors.primary + (isDark ? '40' : '25'),
                  shadowColor: isDark ? '#000000' : colors.primary,
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: isDark ? 0.6 : 0.16,
                  shadowRadius: 24,
                  elevation: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary + (isDark ? '25' : '15'),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Award size={18} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 17,
                      fontWeight: '900',
                      letterSpacing: -0.3,
                    }}
                  >
                    Active Challenges
                  </Text>
                </View>

                {/* Animated description using BlurText */}
                <BlurText
                  text="Here is where your coach sets a challenge for a set of days. Complete each day's challenge to stay on track and level up!"
                  effect="blur"
                  animateBy="words"
                  direction="top"
                  staggerFrom="start"
                  delay={70}
                  stepDuration={0.35}
                  distance={16}
                  color={textSecondaryColor}
                  style={{
                    fontSize: 14,
                    lineHeight: 21,
                    fontWeight: '600',
                    marginBottom: 18,
                  }}
                />

                <TouchableOpacity
                  onPress={handleDismissHighlight}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 6,
                  }}
                >
                  <Text
                    style={{
                      color: getContrastColor(colors.primary),
                      fontSize: 14,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Got It
                  </Text>
                </TouchableOpacity>
              </MotiView>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}
