import React from 'react';
import { Text as RNText, StyleSheet, TextStyle, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { getFontFamilyAndWeight, isExplicitCustomFont, isIconFont } from '@/lib/font-patcher';

interface BrandedTextProps {
  children: React.ReactNode;
  variant?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'xxl';
  color?: 'default' | 'secondary' | 'disabled' | 'primary' | 'accent' | 'error' | 'success' | 'warning';
  weight?: 'heading' | 'body' | '400' | '500' | '600' | '700' | '800' | '900';
  style?: TextStyle;
  preserveFont?: boolean;
}

export function BrandedText({
  children,
  variant = 'base',
  color = 'default',
  weight,
  style,
  preserveFont,
}: BrandedTextProps) {
  const theme = useTheme();

  if (preserveFont) {
    return (
      <RNText
        style={[
          {
            fontSize: theme.typography.sizes[variant],
          },
          style,
        ]}
      >
        {children}
      </RNText>
    );
  }

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

export function Text(props: RNTextProps & { className?: string; preserveFont?: boolean }) {
  if (props.preserveFont) {
    const flat = StyleSheet.flatten(props.style);
    if (flat && flat.fontFamily && flat.fontFamily !== 'System') {
      return <RNText {...props} style={[props.style, { fontWeight: undefined }]} />;
    }
    return <RNText {...props} />;
  }

  const flat = StyleSheet.flatten(props.style) || {};
  const currentFont = flat.fontFamily ? String(flat.fontFamily) : '';

  if (isIconFont(currentFont)) {
    return <RNText {...props} />;
  }

  if (isExplicitCustomFont(currentFont)) {
    return <RNText {...props} style={[props.style, { fontWeight: undefined }]} />;
  }

  const theme = useTheme();
  const fontStyle = getFontFamilyAndWeight(
    theme.typography.fontFamily,
    flat.fontWeight,
    flat.fontSize
  );

  return <RNText {...props} style={[props.style, fontStyle]} />;
}
