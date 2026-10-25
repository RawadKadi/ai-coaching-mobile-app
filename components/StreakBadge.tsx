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
          backgroundColor: isDark
            ? 'rgba(249, 115, 22, 0.12)'
            : 'rgba(249, 115, 22, 0.08)',
          borderWidth: 1,
          borderColor: isDark
            ? 'rgba(249, 115, 22, 0.3)'
            : 'rgba(249, 115, 22, 0.25)',
        },
        style,
      ]}
    >
      <StreakFire
        variant={isCold ? 'cold' : streak > 0 ? 'active' : 'zero'}
        size={size}
      />
      <Text
        style={{
          color: '#F97316',
          fontSize: 15,
          fontWeight: '900',
        }}
      >
        {formatCompactNumber(streak)}
      </Text>
    </TouchableOpacity>
  );
}
