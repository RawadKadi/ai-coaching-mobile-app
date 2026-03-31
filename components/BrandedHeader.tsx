import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft } from 'lucide-react-native';
import { useBrand, useTheme } from '@/contexts/BrandContext';
import { BrandedText } from './BrandedText';
import { scaleBorderRadius } from '@/lib/theme-utils';

interface BrandedHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function BrandedHeader({ title, subtitle, showLogo = true, showBackButton, onBackPress }: BrandedHeaderProps) {
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
      {showBackButton && (
        <TouchableOpacity 
          onPress={onBackPress}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
      )}

      {showLogo && brand?.logo_url && (
        <Image
          source={{ uri: brand.logo_url }}
          style={[
            styles.logo,
            {
              borderRadius: scaleBorderRadius(12, theme.spacing.borderRadiusScale),
            },
          ]}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
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
  backButton: {
    position: 'absolute',
    left: 16,
    top: 20,
    zIndex: 10,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginTop: 4,
  },
});
