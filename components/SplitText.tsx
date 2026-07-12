/**
 * SplitText – Native React Native equivalent of the React Bits SplitText component.
 * Animates text letter-by-letter (or word-by-word) using React Native Reanimated.
 *
 * Props mirror the React Bits API so callers feel identical.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

export type SplitType = 'chars' | 'words' | 'chars, words' | 'words, chars';

export interface SplitTextProps {
  /** The text content to animate */
  text: string;
  /** Extra className-style string (NativeWind). Applied to the wrapping View. */
  className?: string;
  /** Inline style for the wrapping View */
  style?: object;
  /** Text style (color, fontSize, fontWeight …) */
  textStyle?: object;
  /** Delay between each unit animation in ms  (default 40) */
  delay?: number;
  /** Duration of each unit animation in seconds (default 0.55) */
  duration?: number;
  /** Split by 'chars' or 'words'             (default 'chars') */
  splitType?: SplitType;
  /** Initial opacity                          (default 0) */
  fromOpacity?: number;
  /** Initial Y translate in dp               (default 28) */
  fromY?: number;
  /** Text alignment                          (default 'left') */
  textAlign?: 'left' | 'center' | 'right';
  /** Called when all units have finished animating */
  onAnimationComplete?: () => void;
  /** Whether to trigger the animation. Pass a changing value to re-trigger. */
  trigger?: boolean;
}

const SplitText: React.FC<SplitTextProps> = ({
  text = '',
  className,
  style,
  textStyle,
  delay = 40,
  duration = 0.55,
  splitType = 'chars',
  fromOpacity = 0,
  fromY = 28,
  textAlign = 'left',
  onAnimationComplete,
  trigger = true,
}) => {
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      prefersReducedMotion.current = val;
    });
  }, []);

  const units = useMemo<string[]>(() => {
    if (!text) return [];
    const isWords = splitType === 'words' || splitType === 'words, chars';
    if (isWords) return text.split(' ');
    return text.split('');
  }, [text, splitType]);

  const isWords = splitType === 'words' || splitType === 'words, chars';

  const justifyContent =
    textAlign === 'center'
      ? 'center'
      : textAlign === 'right'
      ? 'flex-end'
      : 'flex-start';

  return (
    <View
      style={[{ flexDirection: 'row', flexWrap: 'wrap', justifyContent }, style]}
      accessible
      accessibilityLabel={text}
    >
      {units.map((unit, i) => (
        <AnimatedUnit
          key={`${text}-${i}`}
          unit={unit}
          index={i}
          delay={delay}
          duration={duration}
          fromOpacity={fromOpacity}
          fromY={fromY}
          trigger={trigger}
          isWords={isWords}
          textStyle={textStyle}
          isLastUnit={i === units.length - 1}
          onLastComplete={onAnimationComplete}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </View>
  );
};

interface AnimatedUnitProps {
  unit: string;
  index: number;
  delay: number;
  duration: number;
  fromOpacity: number;
  fromY: number;
  trigger: boolean;
  isWords: boolean;
  textStyle?: object;
  isLastUnit: boolean;
  onLastComplete?: () => void;
  prefersReducedMotion: React.MutableRefObject<boolean>;
}

const AnimatedUnit: React.FC<AnimatedUnitProps> = ({
  unit,
  index,
  delay,
  duration,
  fromOpacity,
  fromY,
  trigger,
  isWords,
  textStyle,
  isLastUnit,
  onLastComplete,
  prefersReducedMotion,
}) => {
  const opacity = useSharedValue(fromOpacity);
  const translateY = useSharedValue(fromY);

  useEffect(() => {
    if (!trigger) return;

    const durationMs = duration * 1000;
    const staggerDelay = index * delay;

    // Reset to initial state before animating (supports re-trigger on text change)
    opacity.value = fromOpacity;
    translateY.value = fromY;

    if (prefersReducedMotion.current) {
      opacity.value = 1;
      translateY.value = 0;
      if (isLastUnit) onLastComplete?.();
      return;
    }

    opacity.value = withDelay(
      staggerDelay,
      withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      staggerDelay,
      withTiming(0, { duration: durationMs, easing: Easing.out(Easing.cubic) })
    );

    if (isLastUnit) {
      const timer = setTimeout(() => {
        onLastComplete?.();
      }, staggerDelay + durationMs);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Text style={[styles.unitText, textStyle]} importantForAccessibility="no">
        {unit}
        {isWords ? ' ' : ''}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  unitText: {
    color: '#FFFFFF',
  },
});

export default SplitText;
