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

export const ClientCardsSkeleton: React.FC<{ count?: number; paddingHorizontal?: number }> = ({ count = 5, paddingHorizontal = 0 }) => {
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
    <View style={{ paddingHorizontal, paddingTop: 10 }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: 1,
            borderRadius: 40,
            padding: 24,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flex: 1 }}>
            {/* Avatar Skeleton */}
            <SkeletonBone
              width={60}
              height={60}
              borderRadius={30}
              opacityAnim={opacityAnim}
              boneColor={boneColor}
            />

            {/* Info Column */}
            <View style={{ flex: 1 }}>
              <SkeletonBone
                width={index % 2 === 0 ? 140 : 160}
                height={18}
                borderRadius={6}
                style={{ marginBottom: 8 }}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={index % 2 === 0 ? '75%' : '60%'}
                height={11}
                borderRadius={4}
                style={{ marginBottom: 8 }}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
              <SkeletonBone
                width={70}
                height={14}
                borderRadius={7}
                opacityAnim={opacityAnim}
                boneColor={boneColor}
              />
            </View>
          </View>

          {/* Right Chevron */}
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
