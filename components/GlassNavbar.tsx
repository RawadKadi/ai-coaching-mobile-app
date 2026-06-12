import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GlassNavbarProps {
  title: string;
}

const NAVBAR_HEIGHT = 60;

export function GlassNavbar({ title }: GlassNavbarProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { height: insets.top + NAVBAR_HEIGHT }]}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
      
      {/* Border to mimic glass edge */}
      <View style={styles.glassEdge} />

      <View style={[styles.content, { paddingTop: insets.top }]}>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100, // Ensure it sits above scrollable content
  },
  glassEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
