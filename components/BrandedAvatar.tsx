import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { getInitials, getContrastColor } from '@/lib/theme-utils';

interface BrandedAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  useBrandColor?: boolean;
  uploading?: boolean;
}

export function BrandedAvatar({
  name,
  imageUrl,
  size = 48,
  useBrandColor = true,
  uploading = false,
}: BrandedAvatarProps) {
  const theme = useTheme();
  const initials = getInitials(name);
  
  // Use brand primary color for background, or gray if not using brand color
  const backgroundColor = useBrandColor ? theme.colors.primary : theme.colors.surfaceAlt;
  const textColor = getContrastColor(backgroundColor);
  
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      {uploading ? (
        <ActivityIndicator size={size * 0.4} color={textColor} />
      ) : imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              color: textColor,
              fontSize: size * 0.4,
            },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '600',
  },
});
