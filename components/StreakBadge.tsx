import React from 'react';
import { TouchableOpacity, Text, ViewStyle, StyleProp } from 'react-native';
import StreakFire from '@/components/StreakFire';
import { formatCompactNumber } from '@/lib/format-utils';

interface StreakBadgeProps {
  streak: number;
  isCold: boolean;
  isDark?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
}

export default function StreakBadge({
  streak,
  isCold,
  isDark = true,
  onPress,
  style,
  size = 20,
}: StreakBadgeProps) {
  const isReset = !streak || streak <= 0;
  const isPaused = !isReset && isCold;

  let backgroundColor = isDark
    ? 'rgba(249, 115, 22, 0.12)'
    : 'rgba(249, 115, 22, 0.08)';
  let borderColor = isDark
    ? 'rgba(249, 115, 22, 0.3)'
    : 'rgba(249, 115, 22, 0.25)';
  let textColor = '#F97316';
  let variant: 'active' | 'cold' | 'zero' = 'active';

  if (isReset) {
    variant = 'zero';
    backgroundColor = isDark
      ? 'rgba(148, 163, 184, 0.12)'
      : 'rgba(100, 116, 139, 0.08)';
    borderColor = isDark
      ? 'rgba(148, 163, 184, 0.25)'
      : 'rgba(148, 163, 184, 0.28)';
    textColor = isDark ? '#94A3B8' : '#64748B';
  } else if (isPaused) {
    variant = 'cold';
    backgroundColor = isDark
      ? 'rgba(56, 189, 248, 0.15)'
      : 'rgba(56, 189, 248, 0.10)';
    borderColor = isDark
      ? 'rgba(56, 189, 248, 0.35)'
      : 'rgba(56, 189, 248, 0.30)';
    textColor = isDark ? '#38BDF8' : '#0284C7';
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!onPress}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor,
          borderWidth: 1,
          borderColor,
        },
        style,
      ]}
    >
      <StreakFire
        variant={variant}
        size={size}
      />
      <Text
        style={{
          color: textColor,
          fontSize: 15,
          fontWeight: '900',
        }}
      >
        {formatCompactNumber(streak || 0)}
      </Text>
    </TouchableOpacity>
  );
}
