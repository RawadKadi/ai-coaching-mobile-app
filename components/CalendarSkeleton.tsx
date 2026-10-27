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
import { isDarkColor } from '@/lib/theme-utils';

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
}> = ({ showBackButton = true }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const isDark = isDarkColor(colors.background || '#020617');

  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const boneColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.07)';

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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: showBackButton ? 40 : 20, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {showBackButton ? (
              <SkeletonBone
                width={40}
                height={40}
                borderRadius={14}
                style={{ marginBottom: 8 }}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            ) : null}

            {/* Month & Year Title */}
            <SkeletonBone
              width={180}
              height={32}
              borderRadius={8}
              style={{ marginBottom: 8 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />

            {/* Date picker button */}
            <SkeletonBone
              width={40}
              height={40}
              borderRadius={14}
              style={{ marginBottom: 8 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* Subtitle */}
          <SkeletonBone
            width={160}
            height={14}
            borderRadius={4}
            style={{ marginTop: 4 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Swipe hint placeholder */}
        <View style={{ paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8, opacity: 0.5 }}>
          <SkeletonBone
            width={48}
            height={10}
            borderRadius={4}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Calendar Box */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : cardBg,
            borderRadius: 36,
            padding: 24,
            marginHorizontal: 24,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          {/* Day-of-week headers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((_, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonBone
                  width={16}
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
              {[0, 1, 2, 3, 4, 5, 6].map((col) => (
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
                    boneColor={boneColor}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Session List */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          scrollEnabled={false}
        >
          <View style={{ marginBottom: 20, marginTop: 8 }}>
            <SkeletonBone
              width={160}
              height={22}
              borderRadius={6}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* 2 Session cards */}
          {[1, 2].map((k) => (
            <View
              key={k}
              style={{
                backgroundColor: cardBg,
                borderRadius: 28,
                padding: 20,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: cardBorder,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SkeletonBone
                  width={72}
                  height={22}
                  borderRadius={11}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={64}
                  height={20}
                  borderRadius={10}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
              <SkeletonBone
                width={k === 1 ? '70%' : '55%'}
                height={18}
                borderRadius={6}
                style={{ marginBottom: 8 }}
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
          ))}
        </ScrollView>
      </View>
    </View>
  );
};
