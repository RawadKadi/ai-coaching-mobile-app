import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'flat';
  style?: ViewStyle;
}

export function BrandedCard({ children, variant = 'default', style }: BrandedCardProps) {
  const theme = useTheme();
  
  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return theme.spacing.cardShadow;
      case 'flat':
        return {};
      default:
        return theme.spacing.cardShadow;
    }
  };
  
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: scaleBorderRadius(12, theme.spacing.borderRadiusScale),
        },
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
  },
});
