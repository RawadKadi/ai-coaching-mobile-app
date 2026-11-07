import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  AccessibilityInfo,
  StatusBar,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor, hexToRGB } from '@/lib/theme-utils';

interface SkeletonBoneProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  opacityAnim: Animated.Value;
  boneColor: string;
}

const SkeletonBone: React.FC<SkeletonBoneProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
  opacityAnim,
  boneColor,
}) => (
  <Animated.View
    style={[
      {
        width: width as any,
        height: height as any,
        borderRadius,
        backgroundColor: boneColor,
        opacity: opacityAnim,
      },
      style,
    ]}
  />
);

export const CalendarSkeleton: React.FC<{
  showBackButton?: boolean;
}> = ({ showBackButton = false }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const isDark = isDarkColor(colors.background || '#020617');

  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const boneColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.07)';

  const primaryRgb = hexToRGB(colors.primary || '#6366F1');
  const primaryBone = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${isDark ? 0.22 : 0.16})`;

  const opacityAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    let isMounted = true;
    let anim: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!isMounted) return;
      if (reduced) {
        opacityAnim.setValue(0.65);
        return;
      }

      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.95,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.45,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    });

    return () => {
      isMounted = false;
      anim?.stop();
    };
  }, [opacityAnim]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background || (isDark ? '#020617' : '#F8FAFC') }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header - matching px-6 pt-10 pb-4 of calendar.tsx */}
        <View style={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {showBackButton && (
                <SkeletonBone
                  width={40}
                  height={40}
                  borderRadius={14}
                  style={{ marginBottom: 8 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              )}
              {/* Month & Year Title */}
              <SkeletonBone
                width={190}
                height={36}
                borderRadius={10}
                style={{ marginBottom: 8 }}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>

            {/* Date picker button */}
            <SkeletonBone
              width={40}
              height={40}
              borderRadius={16}
              style={{ marginBottom: 8 }}
              opacityAnim={opacityAnim}
              boneColor={primaryBone}
            />
          </View>

          {/* Subtitle */}
          <SkeletonBone
            width={210}
            height={16}
            borderRadius={6}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Swipe hint - matching px-4 mb-2 */}
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, opacity: 0.4 }}>
          <SkeletonBone
            width={48}
            height={10}
            borderRadius={4}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Calendar Box - matching rounded-[48px] p-6 mx-3 my-4 */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 48,
            padding: 24,
            marginHorizontal: 12,
            marginVertical: 16,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          {/* Day-of-week headers - matching px-2 mb-6 */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 8 }}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((_, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonBone
                  width={22}
                  height={10}
                  borderRadius={3}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            ))}
          </View>

          {/* 2-Week Day Grid (2 rows x 7 days) */}
          {[0, 1].map((row) => (
            <View
              key={row}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: row === 0 ? 16 : 0,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((col) => {
                const isSelected = row === 0 && col === 2;
                return (
                  <View
                    key={col}
                    style={{
                      flex: 1,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SkeletonBone
                      width={38}
                      height={38}
                      borderRadius={19}
                      opacityAnim={opacityAnim}
                      boneColor={isSelected ? primaryBone : boneColor}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Session List - matching px-3 mt-4 */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 12, marginTop: 16 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160 }}
          scrollEnabled={false}
        >
          <View style={{ marginBottom: 24, marginTop: 16, paddingHorizontal: 4 }}>
            <SkeletonBone
              width={160}
              height={26}
              borderRadius={8}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* Session Cards - matching rounded-[36px] p-6 mb-4 with time, divider, details */}
          {[1, 2].map((k) => (
            <View
              key={k}
              style={{
                backgroundColor: cardBg,
                borderRadius: 36,
                padding: 24,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: cardBorder,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              {/* Left: Time column */}
              <View style={{ alignItems: 'center', marginRight: 16, width: 64 }}>
                <SkeletonBone
                  width={52}
                  height={22}
                  borderRadius={6}
                  style={{ marginBottom: 4 }}
                  opacityAnim={opacityAnim}
                  boneColor={k === 1 ? primaryBone : boneColor}
                />
                <SkeletonBone
                  width={28}
                  height={10}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>

              {/* Vertical divider line */}
              <View
                style={{
                  height: 40,
                  width: 1,
                  backgroundColor: cardBorder,
                  marginRight: 16,
                }}
              />

              {/* Right: Client info */}
              <View style={{ flex: 1 }}>
                <SkeletonBone
                  width={k === 1 ? '70%' : '55%'}
                  height={18}
                  borderRadius={6}
                  style={{ marginBottom: 6 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={k === 1 ? '45%' : '35%'}
                  height={12}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>

              {/* Status / meet indicator */}
              <SkeletonBone
                width={36}
                height={36}
                borderRadius={18}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};
export default CalendarSkeleton;
