import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useBrandColors } from '@/contexts/BrandContext';

interface BrandedProgressBarProps {
  progress: number; // 0-100
  height?: number;
  backgroundColor?: string;
  style?: ViewStyle;
  animated?: boolean;
}

export function BrandedProgressBar({
  progress,
  height = 8,
  backgroundColor = '#E5E7EB',
  style,
  animated = true,
}: BrandedProgressBarProps) {
  const { primary } = useBrandColors();

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress}%`,
            backgroundColor: primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
