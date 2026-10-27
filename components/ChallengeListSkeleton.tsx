import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  AccessibilityInfo,
  StyleProp,
  ViewStyle,
} from 'react-native';
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

export const ChallengeListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const theme = useTheme();
  const colors = theme.colors;
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
    <View style={{ paddingHorizontal: 12, paddingBottom: 60 }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            backgroundColor: cardBg,
            borderRadius: 32,
            padding: 24,
            borderWidth: 1,
            borderColor: cardBorder,
            marginBottom: 16,
          }}
        >
          {/* Top Row: Tag & Chevron */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SkeletonBone
                width={16}
                height={16}
                borderRadius={4}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={95}
                height={12}
                borderRadius={4}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>
            <SkeletonBone
              width={16}
              height={16}
              borderRadius={8}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* Title */}
          <SkeletonBone
            width={index === 0 ? '70%' : index === 1 ? '55%' : '65%'}
            height={22}
            borderRadius={6}
            style={{ marginBottom: 12 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />

          {/* Subtitle / Day & Tasks count */}
          <SkeletonBone
            width={index === 0 ? '50%' : '42%'}
            height={13}
            borderRadius={4}
            style={{ marginBottom: 20 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />

          {/* Progress Bar */}
          <SkeletonBone
            width="100%"
            height={12}
            borderRadius={6}
            style={{ marginBottom: 8 }}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />

          {/* Percentage */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <SkeletonBone
              width={34}
              height={12}
              borderRadius={4}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>
        </View>
      ))}
    </View>
  );
};
