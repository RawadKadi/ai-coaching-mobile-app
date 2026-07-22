import { cn } from "@/lib/utils";
import { useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

export const Component = () => {
  const [count, setCount] = useState(0);

  // We support both Web (using clean radial CSS gradient) and Native (using react-native-svg)
  if (Platform.OS === 'web') {
    return (
      <div className="min-h-screen w-full relative">
        <div
          className="absolute inset-0 z-0"
          style={{
            background: "radial-gradient(125% 125% at 50% 90%, #130f2e 0%, #020617 70%, #020617 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="grad"
            cx="50%"
            cy="90%"
            rx="100%"
            ry="100%"
            fx="50%"
            fy="90%"
          >
            <Stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.5" />
            <Stop offset="60%" stopColor="#0b0826" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#020617" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
      </Svg>
    </View>
  );
};
