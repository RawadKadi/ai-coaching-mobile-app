import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, PanResponder } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useBrand } from '@/contexts/BrandContext';
import { isDarkColor, hexToRGB } from '@/lib/theme-utils';
import { getFontFamily } from '@/hooks/useAppFonts';
import { BlurView } from 'expo-blur';

interface NotificationToastProps {
  senderName: string;
  message: string;
  onPress: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function NotificationToast({
  senderName,
  message,
  onPress,
  onDismiss,
  duration = 5000,
}: NotificationToastProps) {
  const { brand, theme } = useBrand();
  const colors = theme.colors;
  const typography = theme.typography;

  const isDark = isDarkColor(colors.surface || colors.background || '#0F172A');
  const surfaceBase = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const surfaceRgb = hexToRGB(surfaceBase);

  // Background and border adapting to brand theme
  const toastBg = isDark
    ? `rgba(${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}, 0.82)`
    : `rgba(${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}, 0.92)`;

  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.08)';

  // Shape adapting to brand settings (square, rounded, pill)
  const borderRadius =
    brand?.button_shape === 'square' ? 14 : brand?.button_shape === 'rounded' ? 20 : 26;
  const iconBorderRadius = brand?.button_shape === 'square' ? 12 : 22;

  // Typography adapting to brand settings
  const headingFont = getFontFamily(typography?.fontFamily || 'System', 'bold');
  const bodyFont = getFontFamily(typography?.fontFamily || 'System', 'regular');
  const mediumFont = getFontFamily(typography?.fontFamily || 'System', 'medium');

  // Pill and action styling
  const actionPillBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  const actionTextColor = isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(15, 23, 42, 0.5)';

  const slideAnim = useRef(new Animated.Value(-150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    // Slide in with spring physics
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after duration
    const timer = setTimeout(() => {
      slideOut();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const slideOut = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handlePress = () => {
    slideOut();
    setTimeout(() => {
      onPress();
    }, 100);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          pan.setValue({ x: 0, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          slideOut();
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          transform: [
            { translateY: Animated.add(slideAnim, pan.y) },
            { scale: scaleAnim },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={{ width: '100%' }}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 45 : 85}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blurContainer,
            {
              borderRadius,
              backgroundColor: toastBg,
              borderColor,
              shadowColor: isDark ? '#000000' : (colors.primary || '#000000'),
              shadowOpacity: isDark ? 0.35 : 0.12,
              shadowRadius: isDark ? 20 : 16,
              elevation: isDark ? 10 : 6,
            },
          ]}
        >
          {/* Subtle brand glow overlay */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.primary, opacity: isDark ? 0.05 : 0.03 },
            ]}
          />

          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: `${colors.primary}18`,
                borderColor: `${colors.primary}35`,
                borderWidth: 1,
                borderRadius: iconBorderRadius,
              },
            ]}
          >
            <MessageCircle size={20} color={colors.primary} />
          </View>

          <View style={styles.content}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 2,
              }}
            >
              <Text
                style={[
                  styles.senderName,
                  {
                    color: colors.text,
                    fontFamily: headingFont,
                    fontWeight: (typography?.headingWeight as any) || '800',
                  },
                ]}
              >
                {senderName}
              </Text>
              <Text
                style={[
                  styles.nowText,
                  {
                    color:
                      colors.textTertiary ||
                      (isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(15, 23, 42, 0.4)'),
                    fontFamily: mediumFont,
                  },
                ]}
              >
                now
              </Text>
            </View>
            <Text
              style={[
                styles.message,
                {
                  color: colors.textSecondary,
                  fontFamily: bodyFont,
                  fontWeight: (typography?.bodyWeight as any) || '500',
                },
              ]}
              numberOfLines={2}
            >
              {message}
            </Text>
          </View>
        </BlurView>

        {/* Helper Action Text Below */}
        <View style={styles.actionContainer}>
          <View style={[styles.actionPill, { backgroundColor: actionPillBg }]}>
            <Text
              style={[
                styles.action,
                {
                  color: actionTextColor,
                  fontFamily: mediumFont,
                },
              ]}
            >
              Swipe up to dismiss
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  blurContainer: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
  },
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  senderName: {
    fontSize: 15,
    letterSpacing: 0.3,
  },
  nowText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  action: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

