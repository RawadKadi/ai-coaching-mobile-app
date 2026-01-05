import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { ArrowLeft } from 'lucide-react-native';

interface BrandedHeaderProps {
  title?: string;
  showLogo?: boolean;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
}

export function BrandedHeader({
  title,
  showLogo = false,
  showBackButton = false,
  onBackPress,
  rightComponent,
}: BrandedHeaderProps) {
  const { brand } = useBrand();
  const { primary } = useBrandColors();

  return (
    <View style={[styles.header, { borderBottomColor: `${primary}20` }]}>
      {/* Left Side */}
      <View style={styles.leftSection}>
        {showBackButton && onBackPress && (
          <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
        )}
        
        {showLogo && brand?.logo_url && (
          <Image source={{ uri: brand.logo_url }} style={styles.logo} />
        )}
      </View>

      {/* Center - Title or Brand Name */}
      <View style={styles.centerSection}>
        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : brand?.name ? (
          <Text style={[styles.brandName, { color: primary }]}>{brand.name}</Text>
        ) : null}
      </View>

      {/* Right Side */}
      <View style={styles.rightSection}>
        {rightComponent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 4,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
