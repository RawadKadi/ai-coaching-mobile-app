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

export const ChallengeDetailsSkeleton: React.FC = () => {
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top ? insets.top + 8 : 52,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <SkeletonBone
          width={40}
          height={40}
          borderRadius={12}
          style={{ marginRight: 14 }}
          opacityAnim={opacityAnim}
          boneColor={boneColor}
        />
        <View style={{ flex: 1 }}>
          <SkeletonBone
            width={80}
            height={10}
            borderRadius={4}
            style={{ marginBottom: 6 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
          <SkeletonBone
            width={160}
            height={18}
            borderRadius={6}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Description placeholder */}
        <View style={{ paddingHorizontal: 4, marginTop: 14, marginBottom: 4 }}>
          <SkeletonBone
            width="90%"
            height={14}
            borderRadius={4}
            style={{ marginBottom: 6 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
          <SkeletonBone
            width="65%"
            height={14}
            borderRadius={4}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Performance Overview Card */}
        <View
          style={{
            marginTop: 16,
            backgroundColor: cardBg,
            padding: 22,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: cardBorder,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            <SkeletonBone
              width={90}
              height={22}
              borderRadius={999}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
            <SkeletonBone
              width={42}
              height={14}
              borderRadius={4}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* 3 Metric Columns */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
            {[1, 2, 3].map((col) => (
              <View key={col} style={{ alignItems: 'center' }}>
                <SkeletonBone
                  width={40}
                  height={22}
                  borderRadius={6}
                  style={{ marginBottom: 6 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={55}
                  height={11}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            ))}
          </View>

          {/* Progress bar */}
          <SkeletonBone
            width="100%"
            height={8}
            borderRadius={4}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Section Title */}
        <View style={{ paddingHorizontal: 4, marginBottom: 12 }}>
          <SkeletonBone
            width={110}
            height={16}
            borderRadius={6}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>

        {/* Day Card Skeletons */}
        {[1, 2].map((cardIdx) => (
          <View
            key={cardIdx}
            style={{
              backgroundColor: cardBg,
              borderRadius: 28,
              padding: 22,
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SkeletonBone
                  width={34}
                  height={34}
                  borderRadius={12}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={75}
                  height={12}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
              <SkeletonBone
                width={65}
                height={22}
                borderRadius={999}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>

            <SkeletonBone
              width="60%"
              height={20}
              borderRadius={6}
              style={{ marginBottom: 14 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />

            <SkeletonBone
              width="100%"
              height={8}
              borderRadius={4}
              style={{ marginBottom: 14 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SkeletonBone
                width={100}
                height={28}
                borderRadius={12}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={115}
                height={28}
                borderRadius={12}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
