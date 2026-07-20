import React, { forwardRef } from 'react';
import Animated, {
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface BubblePuffProps {
  isMe: boolean;
  children: React.ReactNode;
}

/**
 * BubblePuff — Telegram-style liquid spring entry animation for chat bubbles.
 *
 * Uses native Reanimated layout animations (entering) to guarantee it fires
 * immediately on mount, even inside inverted FlatLists where React lifecycle
 * (like useEffect) can be bypassed or delayed.
 *
 * Physics:
 *   stiffness: 450  — snappy, immediate response
 *   damping:   26   — micro overshoot before settling (the "liquid" feel)
 *   mass:      0.75 — lightweight, fast
 *
 * Transform origin trick:
 *   Sender   (isMe=true) : starts translateX +24 (expands from right/tail)
 *   Receiver (isMe=false): starts translateX -24 (expands from left/tail)
 */
const BubblePuff = forwardRef<any, BubblePuffProps>(({ isMe, children }, ref) => {
  const customEntering = () => {
    'worklet';
    const animations = {
      opacity: withTiming(1, { duration: 180 }),
      transform: [
        { translateY: withSpring(0, { stiffness: 450, damping: 26, mass: 0.75 }) },
        { translateX: withSpring(0, { stiffness: 450, damping: 26, mass: 0.75 }) },
        { scale: withSpring(1, { stiffness: 450, damping: 26, mass: 0.75 }) },
      ],
    };
    
    const initialValues = {
      opacity: 0,
      transform: [
        { translateY: 14 },
        { translateX: isMe ? 24 : -24 },
        { scale: 0.25 },
      ],
    };
    
    return {
      initialValues,
      animations,
    };
  };

  return (
    <Animated.View
      ref={ref}
      entering={customEntering}
      style={{
        width: '100%',
        alignItems: isMe ? 'flex-end' : 'flex-start',
      }}
    >
      {children}
    </Animated.View>
  );
});

export default BubblePuff;
