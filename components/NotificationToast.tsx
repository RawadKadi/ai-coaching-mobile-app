import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, PanResponder } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useBrandColors } from '@/contexts/BrandContext';

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
  const colors = useBrandColors();

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
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
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
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

  // Pan responder for swipe up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond if swiping up (dy < 0)
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward movement
        if (gestureState.dy < 0) {
          pan.setValue({ x: 0, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped up more than 50px, dismiss
        if (gestureState.dy < -50) {
          slideOut();
        } else {
          // Snap back to original position
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Derive a soft tinted background for the icon container from the brand primary color
  // We take the primary color and add ~15% opacity as a tint
  const iconBgColor = colors.primary + '26'; // 26 hex ≈ 15% opacity

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          transform: [
            { translateY: Animated.add(slideAnim, pan.y) },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.toast,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.primary,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
          <MessageCircle size={24} color={colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.senderName, { color: colors.text }]}>{senderName}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {message}
          </Text>
          <Text style={[styles.action, { color: colors.primary }]}>Tap to view • Swipe up to dismiss</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  action: {
    fontSize: 12,
    fontWeight: '600',
  },
});
