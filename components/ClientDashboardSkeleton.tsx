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
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor, hexToRGB } from '@/lib/theme-utils';
import LightRays from '@/components/ui/LightRays';

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

export const ClientDashboardSkeleton: React.FC = () => {
  const theme = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const isDark = isDarkColor(colors.background || '#010417');

  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const boneColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.07)';
  
  const primaryRgb = hexToRGB(colors.primary || '#6366F1');
  const primaryBone = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${isDark ? 0.22 : 0.16})`;

  const bgRgb = hexToRGB(colors.background || (isDark ? '#010417' : '#FFFFFF'));
  const topBarBg = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${isDark ? 0.72 : 0.82})`;
  const topBarBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

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

      {/* Brand-adaptive Light Rays Background */}
      <LightRays
        raysOrigin="top-center"
        raysColor={colors.primary}
        raysSpeed={0.8}
        lightSpread={0.6}
        rayLength={2.8}
        glow={0.5}
        haze={0.2}
        atmosphere={0.7}
        intensity={isDark ? 0.8 : 0.55}
        lightMode={!isDark}
        pulsating={false}
        followMouse={false}
      />

      {/* Fixed Blur Top Bar */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <View
          style={{
            borderBottomWidth: 1,
            borderColor: topBarBorder,
            overflow: 'hidden',
          }}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 70 : 100}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: topBarBg,
              },
            ]}
          />

          <View
            style={{
              paddingTop: insets.top + 8,
              paddingBottom: 12,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Brand Logo & Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 12 }}>
              <SkeletonBone
                width={44}
                height={44}
                borderRadius={14}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
              <SkeletonBone
                width={120}
                height={22}
                borderRadius={8}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>

            {/* Streak & Profile Avatar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <SkeletonBone
                width={64}
                height={34}
                borderRadius={999}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={44}
                height={44}
                borderRadius={22}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{
          paddingTop: insets.top + 76,
          paddingBottom: 140,
        }}
      >
        {/* Client Greeting */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
          <SkeletonBone
            width={180}
            height={36}
            borderRadius={10}
            style={{ marginBottom: 8 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
          <SkeletonBone
            width={130}
            height={36}
            borderRadius={10}
            opacityAnim={opacityAnim}
            boneColor={primaryBone}
          />
        </View>

        <View style={{ paddingHorizontal: 12 }}>
          {/* 1. Check-In Card Skeleton (Hero card at top) */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
              borderRadius: 40,
              padding: 28,
              marginBottom: 16,
              overflow: 'hidden',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <SkeletonBone
                width={24}
                height={24}
                borderRadius={12}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
              <SkeletonBone
                width={90}
                height={12}
                borderRadius={6}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
            </View>

            <SkeletonBone
              width="65%"
              height={26}
              borderRadius={8}
              style={{ marginBottom: 10 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
            <SkeletonBone
              width="90%"
              height={14}
              borderRadius={6}
              style={{ marginBottom: 6 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
            <SkeletonBone
              width="70%"
              height={14}
              borderRadius={6}
              style={{ marginBottom: 20 }}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />

            <SkeletonBone
              width={140}
              height={38}
              borderRadius={999}
              opacityAnim={opacityAnim}
              boneColor={primaryBone}
            />
          </View>

          {/* 2. Steps Card Skeleton */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
              borderRadius: 36,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
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
                height={20}
                borderRadius={10}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <SkeletonBone
                  width={120}
                  height={38}
                  borderRadius={8}
                  opacityAnim={opacityAnim}
                  boneColor={boneColor}
                />
                <SkeletonBone
                  width={42}
                  height={16}
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

          {/* 3. Sleep & Recovery Score Card Skeleton (Big Hero Card) */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
              borderRadius: 44,
              padding: 28,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <SkeletonBone
                  width={42}
                  height={42}
                  borderRadius={16}
                  opacityAnim={opacityAnim}
                  boneColor={primaryBone}
                />
                <View>
                  <SkeletonBone
                    width={110}
                    height={16}
                    borderRadius={6}
                    style={{ marginBottom: 6 }}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={70}
                    height={12}
                    borderRadius={4}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              </View>
              <SkeletonBone
                width={70}
                height={26}
                borderRadius={999}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
            </View>

            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <SkeletonBone
                width={90}
                height={64}
                borderRadius={12}
                style={{ marginBottom: 8 }}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={120}
                height={16}
                borderRadius={6}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              {[1, 2, 3].map((idx) => (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)',
                    borderRadius: 20,
                    padding: 14,
                    alignItems: 'center',
                  }}
                >
                  <SkeletonBone
                    width={36}
                    height={18}
                    borderRadius={6}
                    style={{ marginBottom: 6 }}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                  <SkeletonBone
                    width={50}
                    height={10}
                    borderRadius={4}
                    opacityAnim={opacityAnim}
                    boneColor={boneColor}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* 4. Nutrition Macro Card Skeleton */}
          <View
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
              borderWidth: 1,
              borderRadius: 36,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
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
                width={70}
                height={26}
                borderRadius={999}
                opacityAnim={opacityAnim}
                boneColor={primaryBone}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[1, 2, 3].map((idx) => (
                <View key={idx} style={{ flex: 1 }}>
                  <SkeletonBone
                    height={6}
                    borderRadius={3}
                    style={{ marginBottom: 8 }}
                    opacityAnim={opacityAnim}
                    boneColor={primaryBone}
                  />
                  <SkeletonBone
                    width="60%"
                    height={12}
                    borderRadius={4}
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
  );
};
export default ClientDashboardSkeleton;
