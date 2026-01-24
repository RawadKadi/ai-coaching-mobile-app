import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { getContrastColor } from '@/lib/theme-utils';

interface BrandedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function BrandedButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: BrandedButtonProps) {
  const theme = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.primaryDisabled;
    
    // Determine base color based on variant
    const baseColor = variant === 'primary' 
      ? theme.colors.primary 
      : variant === 'secondary'
      ? theme.colors.secondary
      : 'transparent';
    
    // Apply pressed state
    if (isPressed && variant !== 'outline') {
      return variant === 'primary'
        ? theme.colors.primaryPressed
        : theme.colors.secondaryPressed;
    }
    
    return baseColor;
  };

  const getBorderColor = () => {
    if (variant === 'outline') return theme.colors.primary;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textDisabled;
    if (variant === 'outline') return theme.colors.primary;
    
    // For solid buttons, calculate contrast color
    const bgColor = getBackgroundColor();
    return getContrastColor(bgColor);
  };

  // Get shadow style if enabled
  const shadowStyle = theme.button.shadowEnabled && !disabled
    ? theme.spacing.cardShadow
    : {};

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon}
          <Text 
            style={[
              {
                color: getTextColor(),
                fontSize: theme.typography.sizes.base,
                fontWeight: '600',
                fontFamily: theme.typography.fontFamily,
              },
              textStyle
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </>
  );

  const buttonStyle = [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: 14 * theme.spacing.scale,
      paddingHorizontal: 24 * theme.spacing.scale,
      borderRadius: theme.button.borderRadius * theme.spacing.borderRadiusScale,
      gap: 8,
      borderWidth: variant === 'outline' ? 2 : 0,
      borderColor: getBorderColor(),
    },
    shadowStyle,
    style,
  ];

  return (
    <TouchableOpacity
      style={[
        buttonStyle,
        {
          backgroundColor: getBackgroundColor(),
        },
      ]}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {buttonContent}
    </TouchableOpacity>
  );
}
