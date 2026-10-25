import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

export type BlurTextEffect = 'blur' | 'zoom' | 'tilt' | 'focus' | 'drift';
export type BlurTextStaggerFrom = 'start' | 'center' | 'end' | 'random';
export type BlurTextTrigger = 'view' | 'load' | 'hover' | 'click';

export interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom' | 'left' | 'right';
  stepDuration?: number;
  blur?: number;
  distance?: number;
  effect?: BlurTextEffect;
  staggerFrom?: BlurTextStaggerFrom;
  trigger?: BlurTextTrigger;
  color?: string;
  fromColor?: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  onAnimationComplete?: () => void;
}

interface Piece {
  wordIndex: number;
  content: string;
  key: string;
}

const AXES: Record<NonNullable<BlurTextProps['direction']>, ['x' | 'y', number]> = {
  top: ['y', -1],
  bottom: ['y', 1],
  left: ['x', -1],
  right: ['x', 1],
};

const buildRanks = (count: number, staggerFrom: BlurTextStaggerFrom, seedText: string): number[] => {
  const ranks = Array.from({ length: count }, (_, i) => i);
  if (staggerFrom === 'end') return ranks.map((i) => count - 1 - i);
  if (staggerFrom === 'center') {
    const mid = (count - 1) / 2;
    const offset = count % 2 === 0 ? 0.5 : 0;
    return ranks.map((i) => Math.abs(i - mid) - offset);
  }
  if (staggerFrom === 'random') {
    let seed = 2166136261;
    for (let i = 0; i < seedText.length; i++) {
      seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619) >>> 0;
    }
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const order = ranks.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach((piece, rank) => {
      ranks[piece] = rank;
    });
  }
  return ranks;
};

interface PieceProps {
  content: string;
  rank: number;
  stagger: number;
  totalDuration: number;
  axis: 'x' | 'y';
  sign: number;
  distance: number;
  effect: BlurTextEffect;
  color?: string;
  style?: StyleProp<TextStyle>;
  isLast: boolean;
  onComplete?: () => void;
}

function BlurTextPiece({
  content,
  rank,
  stagger,
  totalDuration,
  axis,
  sign,
  distance,
  effect,
  color,
  style,
  isLast,
  onComplete,
}: PieceProps) {
  const opacity = useSharedValue(0);
  const trans = useSharedValue(sign * distance);
  const scale = useSharedValue(effect === 'zoom' ? 1.35 : 1);

  useEffect(() => {
    const delayMs = rank * stagger;

    opacity.value = withDelay(
      delayMs,
      withTiming(
        1,
        {
          duration: Math.max(200, totalDuration * 1000),
          easing: Easing.bezier(0.33, 1, 0.68, 1),
        },
        (finished) => {
          if (finished && isLast && onComplete) {
            runOnJS(onComplete)();
          }
        }
      )
    );

    trans.value = withDelay(
      delayMs,
      withSpring(0, {
        damping: 16,
        stiffness: 120,
        mass: 0.8,
      })
    );

    if (effect === 'zoom') {
      scale.value = withDelay(
        delayMs,
        withSpring(1, {
          damping: 14,
          stiffness: 120,
        })
      );
    }
  }, [rank, stagger, totalDuration, distance, effect, isLast, onComplete]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        axis === 'y' ? { translateY: trans.value } : { translateX: trans.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.Text style={[style, color ? { color } : undefined, animatedStyle]}>
      {content}
    </Animated.Text>
  );
}

export default function BlurText({
  text = '',
  delay = 70,
  className,
  animateBy = 'words',
  direction = 'top',
  stepDuration = 0.35,
  distance = 18,
  effect = 'blur',
  staggerFrom = 'start',
  color,
  style,
  containerStyle,
  onAnimationComplete,
}: BlurTextProps) {
  const [axis, sign] = AXES[direction] || AXES.top;
  const words = useMemo(() => text.split(' '), [text]);

  const pieces = useMemo<Piece[]>(() => {
    const list: Piece[] = [];
    words.forEach((word, w) => {
      const isLastWord = w === words.length - 1;
      if (animateBy === 'words') {
        list.push({
          wordIndex: w,
          content: isLastWord ? word : `${word} `,
          key: `word-${w}`,
        });
        return;
      }
      Array.from(word).forEach((char, c) => {
        list.push({
          wordIndex: w,
          content: char,
          key: `char-${w}-${c}`,
        });
      });
      if (!isLastWord) {
        list.push({
          wordIndex: w,
          content: ' ',
          key: `space-${w}`,
        });
      }
    });
    return list;
  }, [words, animateBy]);

  const ranks = useMemo(
    () => buildRanks(pieces.length, staggerFrom, text),
    [pieces.length, staggerFrom, text]
  );

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
        },
        containerStyle,
      ]}
    >
      {pieces.map((piece, index) => (
        <BlurTextPiece
          key={piece.key}
          content={piece.content}
          rank={ranks[index]}
          stagger={delay}
          totalDuration={stepDuration}
          axis={axis}
          sign={sign}
          distance={distance}
          effect={effect}
          color={color}
          style={style}
          isLast={index === pieces.length - 1}
          onComplete={onAnimationComplete}
        />
      ))}
    </View>
  );
}
