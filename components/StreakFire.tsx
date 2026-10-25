import React, { useRef } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

const coldFireSource = require('@/assets/animations/cold-fire.json');
const activeFireSource = require('@/assets/animations/Fire.json');
const zeroFireSource = require('@/assets/animations/zero-fire.json');

export type StreakFireVariant = 'active' | 'cold' | 'zero';

export interface StreakFireProps {
  variant: StreakFireVariant;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StreakFire({
  variant,
  size = 48,
  loop = true,
  autoPlay = true,
  style,
}: StreakFireProps) {
  const animationRef = useRef<LottieView>(null);

  const source =
    variant === 'cold'
      ? coldFireSource
      : variant === 'zero'
      ? zeroFireSource
      : activeFireSource;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      pointerEvents="none"
    >
      <LottieView
        ref={animationRef}
        source={source}
        autoPlay={autoPlay}
        loop={loop}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
        }}
      />
    </View>
  );
}
