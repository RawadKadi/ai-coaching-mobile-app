import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useBrand, useTheme } from '@/contexts/BrandContext';
import { BrandedText } from './BrandedText';
import { scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
}

export function BrandedHeader({ title, subtitle, showLogo = true }: BrandedHeaderProps) {
  const { brand } = useBrand();
  const theme = useTheme();
  
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          paddingHorizontal: 16 * theme.spacing.scale,
          paddingVertical: 20 * theme.spacing.scale,
        },
      ]}
    >
      {showLogo && brand?.logo_url && (
        <Image
          source={{ uri: brand.logo_url }}
          style={[
            styles.logo,
            {
              borderRadius: scaleBorderRadius(12, theme.spacing.borderRadiusScale),
            },
          ]}
        />
      )}
      
      <BrandedText variant="xl" weight="heading" style={styles.title}>
        {title || brand?.name || 'Coaching App'}
      </BrandedText>
      
      {subtitle && (
        <BrandedText variant="sm" color="secondary" style={styles.subtitle}>
          {subtitle}
        </BrandedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginTop: 4,
  },
});
