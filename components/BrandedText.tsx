import React from 'react';
import { Text as RNText, StyleSheet, TextStyle, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { getFontFamilyAndWeight } from '@/lib/font-patcher';

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

  const getWeightParam = () => {
    if (weight) {
      if (weight === 'heading') return '700';
      if (weight === 'body') return '400';
      return weight;
    }
    if (variant === 'xl' || variant === 'xxl' || variant === 'lg') {
      return '700';
    }
    return '400';
  };

  const fontStyle = getFontFamilyAndWeight(
    theme.typography.fontFamily,
    getWeightParam(),
    theme.typography.sizes[variant]
  );

  return (
    <RNText
      style={[
        {
          fontSize: theme.typography.sizes[variant],
          color: getTextColor(),
        },
        style,
        fontStyle,
      ]}
    >
      {children}
    </RNText>
  );
}

export function Text(props: RNTextProps & { className?: string }) {
  const theme = useTheme();
  const flat = StyleSheet.flatten(props.style) || {};
  const fontStyle = getFontFamilyAndWeight(
    theme.typography.fontFamily,
    flat.fontWeight,
    flat.fontSize
  );

  return <RNText {...props} style={[props.style, fontStyle]} />;
}
