import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  PanResponder,
  StatusBar,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
} from 'react-native-svg';
import { X, TrendingUp, Users, Award } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsData {
  date: string;
  total_roster: number;
  high_performers: number;
}

interface AnalyticsDetailedModalProps {
  visible: boolean;
  onClose: () => void;
  data: AnalyticsData[];
  currentActive: number;
}

export const AnalyticsDetailedModal: React.FC<AnalyticsDetailedModalProps> = ({
  visible,
  onClose,
  data,
  currentActive,
}) => {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isDark = isDarkColor(colors.background);
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B');
  const cardBg = colors.surface || (isDark ? 'rgba(15, 23, 42, 0.6)' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const primaryColor = colors.primary || '#3B82F6';
  const buttonTextColor =
    colors.textOnPrimary || (isDarkColor(primaryColor) ? '#FFFFFF' : '#0F172A');

  const chartWidth = SCREEN_WIDTH - 48;
  const chartHeight = 200;
  const paddingX = 16;

  // Calculate scales
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

    const rosterLine = points.roster
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
    const performersLine = points.performers
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    return {
      rosterLine,
      rosterArea: `${rosterLine} L ${points.roster[points.roster.length - 1].x} ${chartHeight} L ${points.roster[0].x} ${chartHeight} Z`,
      performersLine,
      performersArea: `${performersLine} L ${points.performers[points.performers.length - 1].x} ${chartHeight} L ${points.performers[0].x} ${chartHeight} Z`,
    };
  }, [points, chartHeight]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt) => {
      if (!data || data.length < 2) return;
      const x = evt.nativeEvent.locationX;
      const usableWidth = chartWidth - paddingX * 2;
      const index = Math.round(
        ((x - paddingX) / usableWidth) * (data.length - 1),
      );
      const safeIndex = Math.max(0, Math.min(data.length - 1, index));

      if (safeIndex !== activeIndex) {
        setActiveIndex(safeIndex);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderRelease: () => setActiveIndex(null),
    onPanResponderTerminate: () => setActiveIndex(null),
  });

  const activeData = activeIndex !== null && data ? data[activeIndex] : null;

  // Calculate growth
  const growth = useMemo(() => {
    if (!data || data.length < 2) return 0;
    const start = data[0].total_roster;
    const end = data[data.length - 1].total_roster;
    if (start === 0) return end > 0 ? 100 : 0;
    return Math.round(((end - start) / start) * 100);
  }, [data]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
        }}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />

        {/* Header */}
        <View className="px-6 py-6 flex-row justify-between items-center">
          <View>
            <Text
              style={{ color: textSecondaryColor }}
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
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close analytics"
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="w-11 h-11 rounded-full items-center justify-center"
          >
            <X size={20} color={textSecondaryColor} />
          </TouchableOpacity>
        </View>

        {/* Hero Stats */}
        <View className="px-6 flex-row gap-4 mb-8">
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="flex-1 p-6 rounded-[28px]"
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
              {data && data.length > 0
                ? data[data.length - 1]?.total_roster || 0
                : 0}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="flex-1 p-6 rounded-[28px]"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Award size={16} color="#A855F7" />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-[11px] font-bold uppercase tracking-wider"
              >
                Active Clients
              </Text>
            </View>
            <Text
              style={{ color: textColor }}
              className="text-3xl font-black"
            >
              {data && data.length > 0
                ? data[data.length - 1]?.high_performers || 0
                : currentActive}
            </Text>
          </View>
        </View>

        {/* Chart Container */}
        <View className="px-6 flex-1">
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
            }}
            className="rounded-[32px] py-6 px-0 h-[280px] justify-center overflow-hidden"
          >
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

            {/* Tooltip Overlay */}
            <AnimatePresence>
              {activeData && (
                <MotiView
                  from={{ opacity: 0, translateY: reduceMotion ? 0 : 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: reduceMotion ? 0 : 8 }}
                  transition={{
                    type: 'timing',
                    duration: reduceMotion ? 0 : 150,
                  }}
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
          <View className="flex-row justify-center gap-8 mt-6">
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
                Active Clients
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View
          style={{
            borderTopColor: cardBorder,
            borderTopWidth: 1,
            backgroundColor: cardBg,
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          className="px-6 pt-6"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-emerald-500/10 rounded-full items-center justify-center border border-emerald-500/20">
              <TrendingUp size={20} color="#10B981" />
            </View>
            <View>
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
                className="text-xs font-medium"
              >
                Past 30 days
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close analytics"
            style={{
              backgroundColor: primaryColor,
            }}
            className="mt-6 py-4 rounded-2xl items-center justify-center shadow-lg"
          >
            <Text
              style={{
                color: buttonTextColor,
              }}
              className="font-black text-sm uppercase tracking-wider"
            >
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
