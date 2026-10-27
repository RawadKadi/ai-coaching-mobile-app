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

export const ChatMessageSkeleton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');

  const incomingBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const incomingBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const incomingBone = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(15, 23, 42, 0.08)';

  const outgoingBg = isDark ? `${colors.primary}28` : `${colors.primary}18`;
  const outgoingBorder = isDark ? `${colors.primary}45` : `${colors.primary}30`;
  const outgoingBone = isDark ? 'rgba(255, 255, 255, 0.22)' : `${colors.primary}35`;

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
    <View style={[{ flex: 1, paddingVertical: 24, paddingHorizontal: 16, justifyContent: 'flex-end' }, style]}>
      {/* 1. Incoming Message (Left) */}
      <View
        style={{
          alignSelf: 'flex-start',
          width: '68%',
          backgroundColor: incomingBg,
          borderColor: incomingBorder,
          borderWidth: 1,
          borderRadius: 24,
          borderBottomLeftRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <SkeletonBone
          width="92%"
          height={14}
          borderRadius={6}
          style={{ marginBottom: 8 }}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
        <SkeletonBone
          width="60%"
          height={14}
          borderRadius={6}
          style={{ marginBottom: 10 }}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
        <SkeletonBone
          width={40}
          height={9}
          borderRadius={4}
          style={{ alignSelf: 'flex-end' }}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
      </View>

      {/* 2. Outgoing Message (Right) */}
      <View
        style={{
          alignSelf: 'flex-end',
          width: '60%',
          backgroundColor: outgoingBg,
          borderColor: outgoingBorder,
          borderWidth: 1,
          borderRadius: 24,
          borderBottomRightRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <SkeletonBone
          width="85%"
          height={14}
          borderRadius={6}
          style={{ marginBottom: 10 }}
          opacityAnim={opacityAnim}
          boneColor={outgoingBone}
        />
        <SkeletonBone
          width={42}
          height={9}
          borderRadius={4}
          style={{ alignSelf: 'flex-end' }}
          opacityAnim={opacityAnim}
          boneColor={outgoingBone}
        />
      </View>

      {/* 3. Incoming Media Card (Left) */}
      <View
        style={{
          alignSelf: 'flex-start',
          width: '74%',
          backgroundColor: incomingBg,
          borderColor: incomingBorder,
          borderWidth: 1,
          borderRadius: 24,
          borderBottomLeftRadius: 4,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <SkeletonBone
          width="100%"
          height={130}
          borderRadius={18}
          style={{ marginBottom: 10 }}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
        <SkeletonBone
          width="48%"
          height={12}
          borderRadius={6}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
      </View>

      {/* 4. Outgoing Message (Right) */}
      <View
        style={{
          alignSelf: 'flex-end',
          width: '72%',
          backgroundColor: outgoingBg,
          borderColor: outgoingBorder,
          borderWidth: 1,
          borderRadius: 24,
          borderBottomRightRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <SkeletonBone
          width="95%"
          height={14}
          borderRadius={6}
          style={{ marginBottom: 8 }}
          opacityAnim={opacityAnim}
          boneColor={outgoingBone}
        />
        <SkeletonBone
          width="50%"
          height={14}
          borderRadius={6}
          style={{ marginBottom: 10 }}
          opacityAnim={opacityAnim}
          boneColor={outgoingBone}
        />
        <SkeletonBone
          width={42}
          height={9}
          borderRadius={4}
          style={{ alignSelf: 'flex-end' }}
          opacityAnim={opacityAnim}
          boneColor={outgoingBone}
        />
      </View>

      {/* 5. Incoming Short Message (Left) */}
      <View
        style={{
          alignSelf: 'flex-start',
          width: '52%',
          backgroundColor: incomingBg,
          borderColor: incomingBorder,
          borderWidth: 1,
          borderRadius: 24,
          borderBottomLeftRadius: 4,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <SkeletonBone
          width="82%"
          height={14}
          borderRadius={6}
          style={{ marginBottom: 10 }}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
        <SkeletonBone
          width={38}
          height={9}
          borderRadius={4}
          style={{ alignSelf: 'flex-end' }}
          opacityAnim={opacityAnim}
          boneColor={incomingBone}
        />
      </View>
    </View>
  );
};
