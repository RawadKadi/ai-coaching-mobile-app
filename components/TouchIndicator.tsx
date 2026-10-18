import React, { useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface TouchIndicatorProps {
  children: React.ReactNode;
}

export default function TouchIndicator({ children }: TouchIndicatorProps) {
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  const handleTouchStart = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    setTouchPos({ x: pageX, y: pageY });

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleTouchMove = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    setTouchPos({ x: pageX, y: pageY });
  };

  const handleTouchEnd = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTouchPos(null);
    });
  };

  return (
    <View
      style={styles.container}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}

      {touchPos && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.touchCircle,
            {
              left: touchPos.x - 20,
              top: touchPos.y - 20,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.innerDot} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  touchCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
  },
  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
});
