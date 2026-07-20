import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, PanResponder } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useBrandColors } from '@/contexts/BrandContext';
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
  const colors = useBrandColors();

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
        activeOpacity={0.8}
        onPress={handlePress}
        style={{ width: '100%' }}
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={[styles.blurContainer, { borderColor: 'rgba(255,255,255,0.1)' }]}
        >
          {/* Subtle gradient glow overlay */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary, opacity: 0.03 }]} />
          
          <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40`, borderWidth: 1 }]}>
            <MessageCircle size={20} color={colors.primary} />
          </View>
          
          <View style={styles.content}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={styles.senderName}>{senderName}</Text>
                <Text style={styles.nowText}>now</Text>
            </View>
            <Text style={styles.message} numberOfLines={2}>
              {message}
            </Text>
          </View>
        </BlurView>
        
        {/* Helper Action Text Below */}
        <View style={styles.actionContainer}>
            <View style={styles.actionPill}>
               <Text style={styles.action}>Swipe up to dismiss</Text>
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
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  nowText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  actionContainer: {
      marginTop: 8,
      alignItems: 'center',
  },
  actionPill: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
  },
  action: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
