import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedInputProps extends TextInputProps {
  error?: boolean;
}

export function BrandedInput({ error, style, ...props }: BrandedInputProps) {
  const theme = useTheme();
  
  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.surface,
          borderColor: error ? theme.colors.error : theme.colors.border,
          borderRadius: scaleBorderRadius(12, theme.spacing.borderRadiusScale),
          color: theme.colors.text,
          fontSize: theme.typography.sizes.base,
          fontFamily: theme.typography.fontFamily,
          fontWeight: theme.typography.bodyWeight as any,
        },
        style,
      ]}
      placeholderTextColor={theme.colors.textSecondary}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    padding: 16,
  },
});
