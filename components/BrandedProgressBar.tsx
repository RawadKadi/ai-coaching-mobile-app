import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedProgressBarProps {
  progress: number; // 0 to 100
  showGradient?: boolean;
  height?: number;
}

export function BrandedProgressBar({
  progress,
  showGradient = false,
  height = 8,
}: BrandedProgressBarProps) {
  const theme = useTheme();
  
  const useGradient = showGradient && theme.button.style === 'gradient';
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: theme.colors.border,
          borderRadius: scaleBorderRadius(height / 2, theme.spacing.borderRadiusScale),
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            width: `${clampedProgress}%`,
            backgroundColor: theme.colors.primary,
            borderRadius: scaleBorderRadius(height / 2, theme.spacing.borderRadiusScale),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
});
