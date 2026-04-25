import React from 'react';
import { View, StyleSheet, Text, AccessibilityInfo } from 'react-native';
import { MotiView } from 'moti';

interface Props {
  userName?: string;
}

export function TypingIndicator({ userName }: Props) {
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const dotSize = 8;
  const spacing = 4;

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      // For older versions of RN addEventListener returns an object with remove
      if (sub && (sub as any).remove) (sub as any).remove();
    };
  }, []);

  const Dot = ({ delay }: { delay: number }) => (
    <MotiView
      from={{ translateY: 0, opacity: 0.4 }}
      animate={{ translateY: reduceMotion ? 0 : -6, opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 500,
        loop: !reduceMotion,
        repeatReverse: true,
        delay: reduceMotion ? 0 : delay,
      }}
      style={{
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize / 2,
        backgroundColor: '#FFFFFF',
        marginHorizontal: spacing / 2,
      }}
    />
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10, scale: 0.9 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      exit={{ opacity: 0, translateY: 10, scale: 0.9 }}
      style={styles.container}
    >
      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
      {userName && (
        <Text style={styles.label}>{userName} is typing...</Text>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  bubble: {
    backgroundColor: '#334155', // Match client bubble color
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    marginLeft: 10,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
