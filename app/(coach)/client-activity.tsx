import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
} from 'react-native-svg';
import {
  ArrowLeft,
  Users,
  Award,
  TrendingUp,
  Info,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsData {
  date: string;
  total_roster: number;
  high_performers: number;
}

export default function ClientActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const { coach } = useAuth();
  const reduceMotion = useReducedMotion();

  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isDark = isDarkColor(colors.background);
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B');
  const cardBg = colors.surface || (isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const primaryColor = colors.primary || '#3B82F6';

  const chartWidth = SCREEN_WIDTH - 48;
  const chartHeight = 200;
  const paddingX = 16;

  const loadData = async () => {
    if (!coach?.id) return;
    try {
      const { data: trendData, error } = await supabase.rpc(
        'get_coach_analytics_trend',
      );
      if (error) throw error;
      if (trendData) {
        setData(trendData);
      }
    } catch (err) {
      console.error('[ClientActivityScreen] Error loading trend:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [coach?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calculate scales (unchanged graph logic)
  const stats = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 10, range: 10 };
    const allValues = data.flatMap((d) => [d.total_roster, d.high_performers]);
    const min = 0; // Always start from 0 for stacked area
    const max = Math.max(...allValues, 5) * 1.2;
    return { min, max, range: max - min };
  }, [data]);

  const points = useMemo(() => {
    if (!data || data.length < 2) return { roster: [], performers: [] };

    const usableWidth = chartWidth - paddingX * 2;

    return {
      roster: data.map((d, i) => ({
        x: paddingX + (i / (data.length - 1)) * usableWidth,
        y:
          chartHeight -
          ((d.total_roster - stats.min) / stats.range) * chartHeight,
      })),
      performers: data.map((d, i) => ({
        x: paddingX + (i / (data.length - 1)) * usableWidth,
        y:
          chartHeight -
          ((d.high_performers - stats.min) / stats.range) * chartHeight,
      })),
    };
  }, [data, stats, chartWidth, chartHeight]);

  const paths = useMemo(() => {
    if (points.roster.length < 2)
      return {
        rosterLine: '',
        rosterArea: '',
        performersLine: '',
        performersArea: '',
      };

    const makeCurvedPath = (pts: { x: number; y: number }[]) => {
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = i > 0 ? pts[i - 1] : pts[0];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
      return d;
    };

    const rosterLine = makeCurvedPath(points.roster);
    const performersLine = makeCurvedPath(points.performers);

    const firstX = points.roster[0].x;
    const lastX = points.roster[points.roster.length - 1].x;

    const rosterArea = `${rosterLine} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`;
    const performersArea = `${performersLine} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`;

    return { rosterLine, rosterArea, performersLine, performersArea };
  }, [points, chartHeight]);

  const updateActivePoint = (x: number) => {
    if (!data || data.length === 0) return;
    const usableWidth = chartWidth - paddingX * 2;
    const relativeX = Math.max(0, Math.min(usableWidth, x - paddingX));
    const index = Math.round((relativeX / usableWidth) * (data.length - 1));

    if (index >= 0 && index < data.length) {
      if (activeIndex !== index) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setActiveIndex(index);
    }
  };

  // Pan Responder for interactive scrubbing (unchanged)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          updateActivePoint(x);
        },
        onPanResponderMove: (evt) => {
          const x = evt.nativeEvent.locationX;
          updateActivePoint(x);
        },
        onPanResponderRelease: () => {
          setActiveIndex(null);
        },
      }),
    [data, chartWidth],
  );

  const activeData = activeIndex !== null && data ? data[activeIndex] : null;

  // Growth calculation (compare last day to 30 days ago)
  const growth = useMemo(() => {
    if (!data || data.length < 2) return 0;
    const start = data[0].total_roster;
    const end = data[data.length - 1].total_roster;
    if (start === 0) return end > 0 ? 100 : 0;
    return Math.round(((end - start) / start) * 100);
  }, [data]);

  const latestTotalRoster = data && data.length > 0
    ? data[data.length - 1]?.total_roster || 0
    : 0;

  const latestActiveClients = data && data.length > 0
    ? data[data.length - 1]?.high_performers || 0
    : 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Header Bar with Back Button */}
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.7}
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: 1,
          }}
          className="w-11 h-11 rounded-full items-center justify-center"
        >
          <ArrowLeft size={20} color={textColor} />
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
            borderColor: cardBorder,
            borderWidth: 1,
          }}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
        >
          <Calendar size={13} color={textSecondaryColor} />
          <Text
            style={{ color: textSecondaryColor }}
            className="text-xs font-bold"
          >
            Past 30 Days
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 24, 40),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
      >
        {/* Title & Description */}
        <View className="px-6 pt-2 pb-4">
          <Text
            style={{ color: primaryColor }}
            className="text-xs font-bold uppercase tracking-wider mb-1"
          >
            Analytics
          </Text>
          <Text
            style={{ color: textColor }}
            className="text-3xl font-black tracking-tight"
          >
            Client Activity
          </Text>
          <Text
            style={{ color: textSecondaryColor }}
            className="text-sm mt-1"
          >
            Daily habit and challenge completion over the last 30 days
          </Text>
        </View>

        {/* Informational Clarification Callout */}
        <View className="px-6 mb-5">
          <View
            style={{
              backgroundColor: isDark
                ? `${primaryColor}12`
                : `${primaryColor}0C`,
              borderColor: `${primaryColor}28`,
              borderWidth: 1,
            }}
            className="flex-row items-center gap-3 p-3.5 rounded-2xl"
          >
            <View
              className="w-8 h-8 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Info size={16} color={primaryColor} />
            </View>
            <Text
              style={{ color: textSecondaryColor }}
              className="text-xs flex-1 leading-4"
            >
              Clients count as active on days they finish all their assigned habits and challenge tasks.
            </Text>
          </View>
        </View>

        {/* Hero Stats */}
        <View className="px-6 flex-row gap-4 mb-6">
          {/* Total Clients Card */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="flex-1 p-5 rounded-[28px]"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Users size={16} color={primaryColor} />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                Total Clients
              </Text>
            </View>
            <Text
              style={{ color: textColor }}
              className="text-3xl font-black"
            >
              {latestTotalRoster}
            </Text>
            <Text
              style={{ color: textSecondaryColor }}
              className="text-xs font-medium mt-1"
            >
              Active roster
            </Text>
          </View>

          {/* Active Clients Card */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="flex-1 p-5 rounded-[28px]"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Award size={16} color="#A855F7" />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                Daily Active
              </Text>
            </View>
            <Text
              style={{ color: textColor }}
              className="text-3xl font-black"
            >
              {latestActiveClients}
            </Text>
            <Text
              style={{ color: textSecondaryColor }}
              className="text-xs font-medium mt-1"
            >
              All tasks done
            </Text>
          </View>
        </View>

        {/* Chart Container (Graph kept as is) */}
        <View className="px-6 mb-6">
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="rounded-[32px] py-6 px-0 h-[280px] justify-center overflow-hidden"
          >
            {loading ? (
              <View className="items-center justify-center py-12">
                <ActivityIndicator size="small" color={primaryColor} />
              </View>
            ) : (
              <View {...panResponder.panHandlers} className="relative">
                <Svg
                  width={chartWidth}
                  height={chartHeight}
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                >
                  {/* Horizontal Grid Lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Line
                      key={i}
                      x1="0"
                      y1={(chartHeight / 4) * i}
                      x2={chartWidth}
                      y2={(chartHeight / 4) * i}
                      stroke={isDark ? '#FFFFFF' : '#000000'}
                      strokeWidth="0.5"
                      opacity={isDark ? 0.08 : 0.06}
                    />
                  ))}

                  <Defs>
                    <LinearGradient id="fillRoster" x1="0" y1="0" x2="0" y2="1">
                      <Stop
                        offset="0%"
                        stopColor={primaryColor}
                        stopOpacity={isDark ? 0.12 : 0.2}
                      />
                      <Stop
                        offset="100%"
                        stopColor={primaryColor}
                        stopOpacity={0.01}
                      />
                    </LinearGradient>
                    <LinearGradient
                      id="fillPerformers"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <Stop
                        offset="0%"
                        stopColor="#A855F7"
                        stopOpacity={isDark ? 0.2 : 0.25}
                      />
                      <Stop
                        offset="100%"
                        stopColor="#A855F7"
                        stopOpacity={0.02}
                      />
                    </LinearGradient>
                  </Defs>

                  {/* Layer 1: Total Roster */}
                  <Path d={paths.rosterArea} fill="url(#fillRoster)" />
                  <Path
                    d={paths.rosterLine}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity={0.6}
                  />

                  {/* Layer 2: High Performers */}
                  <Path d={paths.performersArea} fill="url(#fillPerformers)" />
                  <Path
                    d={paths.performersLine}
                    fill="none"
                    stroke="#A855F7"
                    strokeWidth="3"
                  />

                  {/* Scrubber Line */}
                  {activeIndex !== null && points.roster[activeIndex] && (
                    <>
                      <Line
                        x1={points.roster[activeIndex].x}
                        y1="0"
                        x2={points.roster[activeIndex].x}
                        y2={chartHeight}
                        stroke={textColor}
                        strokeWidth="1"
                        opacity={0.35}
                      />
                      <Circle
                        cx={points.performers[activeIndex].x}
                        cy={points.performers[activeIndex].y}
                        r="6"
                        fill="#A855F7"
                        stroke={colors.background}
                        strokeWidth="2"
                      />
                    </>
                  )}
                </Svg>
              </View>
            )}

            {/* Tooltip Overlay */}
            <AnimatePresence>
              {activeData && (
                <MotiView
                  from={{ opacity: 0, translateY: reduceMotion ? 0 : 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: reduceMotion ? 0 : 8 }}
                  transition={
                    {
                      type: 'timing',
                      duration: reduceMotion ? 0 : 150,
                    } as any
                  }
                  style={{
                    backgroundColor: isDark
                      ? 'rgba(15, 23, 42, 0.95)'
                      : 'rgba(255, 255, 255, 0.95)',
                    borderColor: cardBorder,
                    borderWidth: 1,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.3 : 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  className="absolute top-4 left-6 right-6 p-4 rounded-2xl flex-row justify-between items-center"
                >
                  <View>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
                    >
                      {new Date(activeData.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text
                      style={{ color: textColor }}
                      className="font-black text-xs"
                    >
                      Daily Activity
                    </Text>
                  </View>
                  <View className="flex-row gap-4">
                    <View className="items-end">
                      <Text
                        style={{ color: primaryColor }}
                        className="text-[10px] font-bold uppercase"
                      >
                        Total
                      </Text>
                      <Text
                        style={{ color: textColor }}
                        className="font-black text-lg"
                      >
                        {activeData.total_roster}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-purple-500 text-[10px] font-bold uppercase">
                        Active
                      </Text>
                      <Text
                        style={{ color: textColor }}
                        className="font-black text-lg"
                      >
                        {activeData.high_performers}
                      </Text>
                    </View>
                  </View>
                </MotiView>
              )}
            </AnimatePresence>
          </View>

          {/* Legend */}
          <View className="flex-row justify-center gap-8 mt-5">
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  backgroundColor: primaryColor,
                  opacity: 0.8,
                }}
                className="w-3 h-3 rounded-full"
              />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs font-bold"
              >
                Total Clients
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full bg-purple-600" />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs font-bold"
              >
                Active (All Tasks Done)
              </Text>
            </View>
          </View>
        </View>

        {/* 30-Day Trend Summary Card (Clean, no 'Back to Dashboard' button) */}
        <View className="px-6">
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="p-5 rounded-[28px] flex-row items-center gap-3.5"
          >
            <View className="w-11 h-11 bg-emerald-500/10 rounded-2xl items-center justify-center border border-emerald-500/20">
              <TrendingUp size={22} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text
                style={{ color: textColor }}
                className="font-bold text-sm tracking-tight"
              >
                {growth >= 0
                  ? `Up ${growth}% this month`
                  : `Down ${Math.abs(growth)}% this month`}
              </Text>
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs font-medium mt-0.5"
              >
                Client roster trend over the past 30 days
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
