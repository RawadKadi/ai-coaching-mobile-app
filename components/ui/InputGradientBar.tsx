import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBrandColors } from '@/contexts/BrandContext';

interface InputGradientBarProps {
  children: React.ReactNode;
  paddingBottom?: number;
}

/**
 * Wraps the chat input bar with a gradient that slides left ↔ right.
 * The gradient extends upward from behind the input into the chat area.
 */
export default function InputGradientBar({ children, paddingBottom = 0 }: InputGradientBarProps) {
  const { primary } = useBrandColors();
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  const translateXInterpolated = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });

  return (
    // overflow: visible so the gradient glow bleeds upward into the chat area
    <View style={{ position: 'relative', paddingBottom }}>
      {/* Dark background base — covers only the input area */}
      <View style={[StyleSheet.absoluteFillObject, styles.darkBase]} pointerEvents="none" />

      {/*
        Gradient strip positioned absolutely so it extends ABOVE the input.
        top: -80 makes the glow rise up behind the messages area.
        The strip slides left-to-right.
      */}
      <Animated.View
        style={[
          styles.gradientStrip,
          { transform: [{ translateX: translateXInterpolated }] },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            'transparent',
            `${primary}18`,
            `${primary}38`,
            `${primary}18`,
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Top border glow line */}
      <View style={[styles.topBorder, { backgroundColor: `${primary}44` }]} pointerEvents="none" />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  darkBase: {
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
  },
  gradientStrip: {
    position: 'absolute',
    // Extend 80px above the input container so gradient glows upward
    top: -80,
    bottom: 0,
    // Wider than container for the sliding effect to look smooth
    left: -100,
    right: -100,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});
