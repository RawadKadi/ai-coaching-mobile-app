import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, PanResponder } from 'react-native';
import { MessageCircle } from 'lucide-react-native';

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
        style={styles.toast}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <MessageCircle size={24} color="#3B82F6" />
        </View>
        <View style={styles.content}>
          <Text style={styles.senderName}>{senderName}</Text>
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
          <Text style={styles.action}>Tap to view • Swipe up to dismiss</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
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
    color: '#111827',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  action: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
});
