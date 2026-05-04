import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';

export interface RotatingTextRef {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

export interface RotatingTextProps {
  texts: string[];
  transition?: any;
  initial?: any;
  animate?: any;
  exit?: any;
  animatePresenceMode?: 'sync' | 'wait';
  animatePresenceInitial?: boolean;
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: 'first' | 'last' | 'center' | 'random' | number;
  loop?: boolean;
  auto?: boolean;
  splitBy?: string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
}

const RotatingText = forwardRef<RotatingTextRef, RotatingTextProps>(
  (
    {
      texts,
      transition = { type: 'spring', damping: 25, stiffness: 300 },
      initial = { translateY: 20, opacity: 0 },
      animate = { translateY: 0, opacity: 1 },
      exit = { translateY: -20, opacity: 0 },
      animatePresenceMode = 'wait',
      animatePresenceInitial = false,
      rotationInterval = 2000,
      staggerDuration = 0,
      staggerFrom = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      onNext,
      mainClassName = '',
      splitLevelClassName = '',
      elementLevelClassName = '',
    },
    ref
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState<number>(0);

    const handleIndexChange = useCallback(
      (newIndex: number) => {
        setCurrentTextIndex(newIndex);
        if (onNext) onNext(newIndex);
      },
      [onNext]
    );

    const next = useCallback(() => {
      const nextIndex = currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
      if (nextIndex !== currentTextIndex) {
        handleIndexChange(nextIndex);
      }
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const previous = useCallback(() => {
      const prevIndex = currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
      if (prevIndex !== currentTextIndex) {
        handleIndexChange(prevIndex);
      }
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const jumpTo = useCallback(
      (index: number) => {
        const validIndex = Math.max(0, Math.min(index, texts.length - 1));
        if (validIndex !== currentTextIndex) {
          handleIndexChange(validIndex);
        }
      },
      [texts.length, currentTextIndex, handleIndexChange]
    );

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) {
        handleIndexChange(0);
      }
    }, [currentTextIndex, handleIndexChange]);

    useImperativeHandle(
      ref,
      () => ({
        next,
        previous,
        jumpTo,
        reset
      }),
      [next, previous, jumpTo, reset]
    );

    useEffect(() => {
      if (!auto) return;
      const intervalId = setInterval(next, rotationInterval);
      return () => clearInterval(intervalId);
    }, [next, rotationInterval, auto]);

    // Simple implementation for Native - rotating the entire string instead of characters
    // since character splitting in Moti/Native is very performance heavy and requires complex layout management.
    return (
      <View className={mainClassName}>
        <AnimatePresence mode={animatePresenceMode}>
          <MotiView
            key={currentTextIndex}
            from={initial}
            animate={animate}
            exit={exit}
            transition={transition}
          >
            <Text className={elementLevelClassName}>
              {texts[currentTextIndex]}
            </Text>
          </MotiView>
        </AnimatePresence>
      </View>
    );
  }
);

RotatingText.displayName = 'RotatingText';
export default RotatingText;
