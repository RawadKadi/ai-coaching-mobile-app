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

export const PlanSkeleton: React.FC = () => {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const isDark = isDarkColor(colors.background || '#020617');

  const cardBg = isDark ? '#0F172A' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
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

      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header Section */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Brand Logo Avatar */}
              <SkeletonBone
                width={44}
                height={44}
                borderRadius={14}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />

              <View>
                {/* Plan Title */}
                <SkeletonBone
                  width={80}
                  height={26}
                  borderRadius={8}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                {/* Date Subtitle */}
                <SkeletonBone
                  width={110}
                  height={10}
                  borderRadius={5}
                  style={{ marginTop: 6 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            </View>

            {/* Streak Pill */}
            <SkeletonBone
              width={64}
              height={34}
              borderRadius={999}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          scrollEnabled={false}
        >
          <View style={{ paddingHorizontal: 12 }}>
            {/* 1. HERO CARD: Daily Tasks */}
            <View
              style={{
                marginBottom: 14,
                backgroundColor: cardBg,
                borderColor: cardBorder,
                borderWidth: 1,
                borderRadius: 28,
                padding: 22,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.3 : 0.05,
                shadowRadius: 14,
                elevation: 4,
                overflow: 'hidden',
              }}
            >
              {/* Header Row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SkeletonBone
                    width={34}
                    height={34}
                    borderRadius={12}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={85}
                    height={12}
                    borderRadius={6}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SkeletonBone
                    width={72}
                    height={26}
                    borderRadius={999}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={18}
                    height={18}
                    borderRadius={9}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              </View>

              {/* Main Big Headline */}
              <SkeletonBone
                width="68%"
                height={24}
                borderRadius={8}
                style={{ marginBottom: 14 }}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />

              {/* Progress Bar Row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <SkeletonBone
                  height={8}
                  borderRadius={4}
                  style={{ flex: 1 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={32}
                  height={14}
                  borderRadius={4}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>

              {/* Preview Chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <SkeletonBone
                  width={112}
                  height={32}
                  borderRadius={12}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={128}
                  height={32}
                  borderRadius={12}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={68}
                  height={32}
                  borderRadius={12}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            </View>

            {/* 2. BENTO ROW: Calendar & Challenges */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
              {/* Calendar Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderWidth: 1,
                  borderRadius: 26,
                  padding: 18,
                  minHeight: 135,
                  justifyContent: 'space-between',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.2 : 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <SkeletonBone
                    width={42}
                    height={42}
                    borderRadius={14}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={18}
                    height={18}
                    borderRadius={9}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>

                <View>
                  <SkeletonBone
                    width="65%"
                    height={18}
                    borderRadius={6}
                    style={{ marginBottom: 6 }}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width="85%"
                    height={12}
                    borderRadius={4}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              </View>

              {/* Challenges Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderWidth: 1,
                  borderRadius: 26,
                  padding: 18,
                  minHeight: 135,
                  justifyContent: 'space-between',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.2 : 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <SkeletonBone
                    width={42}
                    height={42}
                    borderRadius={14}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={56}
                    height={20}
                    borderRadius={10}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>

                <View>
                  <SkeletonBone
                    width="75%"
                    height={18}
                    borderRadius={6}
                    style={{ marginBottom: 6 }}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width="70%"
                    height={12}
                    borderRadius={4}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              </View>
            </View>

            {/* 3. WIDE CARD: Analytics */}
            <View
              style={{
                backgroundColor: cardBg,
                borderColor: cardBorder,
                borderWidth: 1,
                borderRadius: 26,
                padding: 20,
                marginBottom: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: isDark ? 0.2 : 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <SkeletonBone
                    width={46}
                    height={46}
                    borderRadius={16}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <View>
                    <SkeletonBone
                      width={85}
                      height={18}
                      borderRadius={6}
                      style={{ marginBottom: 6 }}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                    <SkeletonBone
                      width={180}
                      height={13}
                      borderRadius={4}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                </View>

                <SkeletonBone
                  width={18}
                  height={18}
                  borderRadius={9}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>
            </View>

            {/* 4. Activity Logs Section (Daily Tasks List) */}
            <View style={{ paddingBottom: 24 }}>
              <View style={{ marginBottom: 16, marginTop: 8, paddingHorizontal: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SkeletonBone
                    width={16}
                    height={16}
                    borderRadius={4}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={100}
                    height={18}
                    borderRadius={6}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                {[1, 2, 3].map((itemKey) => (
                  <View
                    key={itemKey}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 20,
                      backgroundColor: cardBg,
                      borderRadius: 30,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      marginBottom: 12,
                    }}
                  >
                    <SkeletonBone
                      width={48}
                      height={48}
                      borderRadius={16}
                      style={{ marginRight: 16 }}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                    <View style={{ flex: 1 }}>
                      <SkeletonBone
                        width={itemKey === 1 ? '62%' : itemKey === 2 ? '74%' : '54%'}
                        height={16}
                        borderRadius={6}
                        style={{ marginBottom: 6 }}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                      <SkeletonBone
                        width={itemKey === 1 ? '42%' : itemKey === 2 ? '50%' : '36%'}
                        height={10}
                        borderRadius={4}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>
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
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};
