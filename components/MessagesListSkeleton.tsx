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
  borderRadius = 6,
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

export const MessagesListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
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
    <View style={{ paddingHorizontal: 24, paddingBottom: 140 }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 20,
            borderRadius: 32,
            borderWidth: 1,
            backgroundColor: cardBg,
            borderColor: cardBorder,
            marginBottom: 16,
          }}
        >
          {/* Avatar Skeleton */}
          <View style={{ position: 'relative', marginRight: 16 }}>
            <SkeletonBone
              width={56}
              height={56}
              borderRadius={28}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* Name & Message preview */}
          <View style={{ flex: 1, marginRight: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <SkeletonBone
                width={index % 2 === 0 ? 120 : 145}
                height={16}
                borderRadius={6}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={42}
                height={10}
                borderRadius={4}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>
            <SkeletonBone
              width={index % 2 === 0 ? '82%' : '68%'}
              height={13}
              borderRadius={4}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />
          </View>

          {/* Right Chevron / Badge Skeleton */}
          <SkeletonBone
            width={18}
            height={18}
            borderRadius={9}
            opacityAnim={opacityAnim}
            boneColor={boneColor}
          />
        </View>
      ))}
    </View>
  );
};
