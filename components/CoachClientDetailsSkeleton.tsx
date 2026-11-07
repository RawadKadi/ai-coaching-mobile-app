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
  SafeAreaView,
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

export const CoachClientDetailsSkeleton: React.FC = () => {
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Header - matching px-6 pt-10 pb-5 border-b */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              paddingTop: 40,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              {/* Back button */}
              <SkeletonBone
                width={40}
                height={40}
                borderRadius={16}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              {/* Avatar */}
              <SkeletonBone
                width={42}
                height={42}
                borderRadius={21}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
              {/* Name & Email */}
              <View style={{ flex: 1 }}>
                <SkeletonBone
                  width={130}
                  height={18}
                  borderRadius={6}
                  style={{ marginBottom: 4 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={100}
                  height={12}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            </View>

            {/* Scheduler button */}
            <SkeletonBone
              width={40}
              height={40}
              borderRadius={16}
              opacityAnim={opacityAnim}
              boneColor={primaryBone}
            />
          </View>

          {/* Main content - matching ScrollView px-3 pt-3 exactly */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            scrollEnabled={false}
          >
            <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
              {/* 1. Steps Card (Matching Dashboard Design: rounded-[36px] p-6 mb-3) */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderWidth: 1,
                  borderRadius: 36,
                  padding: 24,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <SkeletonBone
                      width={40}
                      height={40}
                      borderRadius={16}
                      opacityAnim={opacityAnim}
                      boneColor={primaryBone}
                    />
                    <SkeletonBone
                      width={90}
                      height={18}
                      borderRadius={6}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                  <SkeletonBone
                    width={80}
                    height={16}
                    borderRadius={4}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <SkeletonBone
                      width={110}
                      height={36}
                      borderRadius={8}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                    <SkeletonBone
                      width={40}
                      height={14}
                      borderRadius={4}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                  <SkeletonBone
                    width={90}
                    height={28}
                    borderRadius={6}
                    opacityAnim={opacityAnim}
                    boneColor={primaryBone}
                  />
                </View>
              </View>

              {/* 2. Core Health Metrics Grid (2x2 with Huge Numbers: gap-3 mb-3) */}
              {/* Row 1: Streak and Weight */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {[1, 2].map((idx) => (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderWidth: 1,
                      borderRadius: 32,
                      padding: 24,
                      justifyContent: 'space-between',
                      minHeight: 140,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <SkeletonBone
                        width={40}
                        height={40}
                        borderRadius={16}
                        opacityAnim={opacityAnim}
                        boneColor={primaryBone}
                      />
                      <SkeletonBone
                        width={18}
                        height={18}
                        borderRadius={9}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <SkeletonBone
                        width={60}
                        height={32}
                        borderRadius={8}
                        style={{ marginBottom: 6 }}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                      <SkeletonBone
                        width={80}
                        height={12}
                        borderRadius={4}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Row 2: Sleep and Energy */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {[1, 2].map((idx) => (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderWidth: 1,
                      borderRadius: 32,
                      padding: 24,
                      justifyContent: 'space-between',
                      minHeight: 140,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <SkeletonBone
                        width={40}
                        height={40}
                        borderRadius={16}
                        opacityAnim={opacityAnim}
                        boneColor={primaryBone}
                      />
                      <SkeletonBone
                        width={18}
                        height={18}
                        borderRadius={9}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <SkeletonBone
                        width={60}
                        height={32}
                        borderRadius={8}
                        style={{ marginBottom: 6 }}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                      <SkeletonBone
                        width={80}
                        height={12}
                        borderRadius={4}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* 3. Client Goals Card (rounded-[32px] p-6 mb-3) */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderWidth: 1,
                  borderRadius: 32,
                  padding: 24,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <SkeletonBone
                      width={38}
                      height={38}
                      borderRadius={14}
                      opacityAnim={opacityAnim}
                      boneColor={primaryBone}
                    />
                    <SkeletonBone
                      width={100}
                      height={18}
                      borderRadius={6}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                  <SkeletonBone
                    width={18}
                    height={18}
                    borderRadius={9}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>

                <SkeletonBone
                  width="85%"
                  height={14}
                  borderRadius={4}
                  style={{ marginBottom: 6 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width="60%"
                  height={14}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>

              {/* 4. Live Coaching Sessions Card (rounded-[32px] p-6 mb-3) */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderWidth: 1,
                  borderRadius: 32,
                  padding: 24,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <SkeletonBone
                      width={38}
                      height={38}
                      borderRadius={14}
                      opacityAnim={opacityAnim}
                      boneColor={primaryBone}
                    />
                    <SkeletonBone
                      width={120}
                      height={18}
                      borderRadius={6}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                  <SkeletonBone
                    width={60}
                    height={24}
                    borderRadius={999}
                    opacityAnim={opacityAnim}
                    boneColor={primaryBone}
                  />
                </View>

                <SkeletonBone
                  width="75%"
                  height={14}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
};
export default CoachClientDetailsSkeleton;
