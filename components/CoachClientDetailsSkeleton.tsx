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

export const CoachClientDetailsSkeleton: React.FC = () => {
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: insets.top ? 10 : 20 }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              paddingBottom: 20,
              borderBottomWidth: 1,
              borderBottomColor: cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* Back button */}
              <SkeletonBone
                width={40}
                height={40}
                borderRadius={12}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              {/* Avatar */}
              <SkeletonBone
                width={40}
                height={40}
                borderRadius={20}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              {/* Name & Email */}
              <View>
                <SkeletonBone
                  width={140}
                  height={18}
                  borderRadius={6}
                  style={{ marginBottom: 6 }}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={110}
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
              borderRadius={12}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* Horizontal Tab Bar */}
          <View
            style={{
              borderBottomWidth: 1,
              borderBottomColor: cardBorder,
              paddingTop: 16,
              paddingBottom: 16,
              paddingHorizontal: 24,
              flexDirection: 'row',
              gap: 28,
            }}
          >
            <SkeletonBone
              width={75}
              height={14}
              borderRadius={6}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
            <SkeletonBone
              width={85}
              height={14}
              borderRadius={6}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
            <SkeletonBone
              width={80}
              height={14}
              borderRadius={6}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
            <SkeletonBone
              width={70}
              height={14}
              borderRadius={6}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            scrollEnabled={false}
          >
            {/* Overview Metrics Grid */}
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}>
              {/* Today's Steps Card (Full Width) */}
              <View
                style={{
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  borderWidth: 1,
                  borderRadius: 32,
                  padding: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <SkeletonBone
                    width={48}
                    height={48}
                    borderRadius={16}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <View>
                    <SkeletonBone
                      width={90}
                      height={12}
                      borderRadius={4}
                      style={{ marginBottom: 6 }}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                    <SkeletonBone
                      width={120}
                      height={24}
                      borderRadius={6}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                </View>
                <SkeletonBone
                  width={60}
                  height={16}
                  borderRadius={6}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>

              {/* 2x2 Metric Cards Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                {[1, 2, 3, 4].map((idx) => (
                  <View
                    key={idx}
                    style={{
                      width: '47%',
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderWidth: 1,
                      borderRadius: 32,
                      padding: 20,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <SkeletonBone
                        width={38}
                        height={38}
                        borderRadius={14}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                      <SkeletonBone
                        width={30}
                        height={10}
                        borderRadius={4}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>
                    <SkeletonBone
                      width={60}
                      height={11}
                      borderRadius={4}
                      style={{ marginBottom: 6 }}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                    <SkeletonBone
                      width={90}
                      height={22}
                      borderRadius={6}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                  </View>
                ))}
              </View>

              {/* Tasks / Activity section title */}
              <View style={{ marginTop: 8, marginBottom: 14 }}>
                <SkeletonBone
                  width={120}
                  height={18}
                  borderRadius={6}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
              </View>

              {/* 2 Task rows */}
              {[1, 2].map((k) => (
                <View
                  key={k}
                  style={{
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    borderWidth: 1,
                    borderRadius: 24,
                    padding: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <SkeletonBone
                      width={38}
                      height={38}
                      borderRadius={12}
                      opacityAnim={opacityAnim}
                      boneColor={boneColor}
                    />
                    <View>
                      <SkeletonBone
                        width={130}
                        height={16}
                        borderRadius={6}
                        style={{ marginBottom: 6 }}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                      <SkeletonBone
                        width={80}
                        height={10}
                        borderRadius={4}
                        opacityAnim={opacityAnim}
                        boneColor={boneColor}
                      />
                    </View>
                  </View>
                  <SkeletonBone
                    width={28}
                    height={28}
                    borderRadius={14}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
};
