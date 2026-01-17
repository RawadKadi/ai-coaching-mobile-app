import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';

interface BrandedTextProps {
  children: React.ReactNode;
  variant?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'xxl';
  color?: 'default' | 'secondary' | 'disabled' | 'primary' | 'accent' | 'error' | 'success' | 'warning';
  weight?: 'heading' | 'body' | '400' | '500' | '600' | '700' | '800' | '900';
  style?: TextStyle;
}

export function BrandedText({
  children,
  variant = 'base',
  color = 'default',
  weight,
  style,
}: BrandedTextProps) {
  const theme = useTheme();
  
  const getTextColor = () => {
    switch (color) {
      case 'primary':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.textSecondary;
      case 'disabled':
        return theme.colors.textDisabled;
      case 'accent':
        return theme.colors.accent;
      case 'error':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.text;
    }
  };
  
  const getFontWeight = () => {
    if (weight) {
      if (weight === 'heading') return theme.typography.headingWeight;
      if (weight === 'body') return theme.typography.bodyWeight;
      return weight;
    }
    
    // Default: use heading weight for xl and xxl variants
    if (variant === 'xl' || variant === 'xxl') {
      return theme.typography.headingWeight;
    }
    
    return theme.typography.bodyWeight;
  };
  
  return (
    <Text
      style={[
        {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes[variant],
          fontWeight: getFontWeight() as any,
          color: getTextColor(),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
