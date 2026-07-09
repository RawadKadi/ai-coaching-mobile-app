/**
 * StrandsBackground — v4 (Smooth + Performant)
 *
 * KEY FIXES from previous versions:
 *  • Removed ALL feGaussianBlur filters — they force software rendering
 *    and are the #1 cause of dropped frames in RN SVG.
 *  • Removed the rAF + setState loop — calling setState 60×/sec triggers
 *    60 React reconciliation passes per second which lags the entire app.
 *  • Back to Reanimated UI-thread worklets (zero JS thread involvement).
 *  • Path computed ONCE per strand per frame via useDerivedValue, then
 *    shared across all glow-pass AnimatedPaths via useAnimatedProps.
 *
 * GLOW (no filters):
 *  Simulated with 4 concentric strokes per strand, from wide+faint → thin+bright.
 *  This replicates the light fall-off of a blur at near-zero GPU cost.
 */

import React, { useEffect, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Strand definitions ───────────────────────────────────────────────────
interface StrandConfig {
  id: string;
  yFraction: number;   // 0–1 vertical centre as fraction of height
  amplitude: number;   // wave height as fraction of height
  wavelength: number;  // wave width as fraction of width
  phase: number;       // radians phase offset
  speed: number;       // animation multiplier (affects full-cycle pacing)
  colorA: string;
  colorB: string;
}

const STRANDS: StrandConfig[] = [
  {
    id: 's0',
    yFraction: 0.30,
    amplitude: 0.14,
    wavelength: 0.70,
    phase: 0,
    speed: 0.9,
    colorA: '#3B82F6',
    colorB: '#6366F1',
  },
  {
    id: 's1',
    yFraction: 0.50,
    amplitude: 0.11,
    wavelength: 0.85,
    phase: 1.5,
    speed: 0.6,
    colorA: '#818CF8',
    colorB: '#7C3AED',
  },
  {
    id: 's2',
    yFraction: 0.70,
    amplitude: 0.10,
    wavelength: 0.60,
    phase: 2.9,
    speed: 1.1,
    colorA: '#60A5FA',
    colorB: '#3B82F6',
  },
];

// ─── Wave path math (UI-thread worklet) ──────────────────────────────────
function buildWavePath(
  width: number,
  height: number,
  strand: StrandConfig,
  t: number,
): string {
  'worklet';
  const baseY = strand.yFraction * height;
  const amp   = strand.amplitude  * height;
  const wl    = strand.wavelength * width;
  const SEGS  = 10;
  const segW  = width / SEGS;

  const evalY = (x: number): number =>
    baseY + amp * Math.sin((2 * Math.PI * x) / wl + strand.phase + t * strand.speed);

  let d = `M 0 ${evalY(0).toFixed(3)}`;
  for (let i = 0; i < SEGS; i++) {
    const x0   = i * segW;
    const x1   = x0 + segW;
    const cp1x = x0 + segW / 3;
    const cp2x = x0 + (2 * segW) / 3;
    d +=
      ` C ${cp1x.toFixed(3)} ${evalY(cp1x).toFixed(3)},` +
      ` ${cp2x.toFixed(3)} ${evalY(cp2x).toFixed(3)},` +
      ` ${x1.toFixed(3)} ${evalY(x1).toFixed(3)}`;
  }
  return d;
}

// ─── Per-strand animated renderer ────────────────────────────────────────
// Computes the path ONCE per frame via useDerivedValue,
// then 4 AnimatedPaths share that same derived value — no repeated math.
interface StrandGlowProps {
  config: StrandConfig;
  width: number;
  height: number;
  progress: Animated.SharedValue<number>;
}

function StrandGlow({ config, width, height, progress }: StrandGlowProps) {
  // Compute path string once on the UI thread
  const pathD = useDerivedValue(() => {
    'worklet';
    const t = interpolate(progress.value, [0, 1], [0, 2 * Math.PI]);
    return buildWavePath(width, height, config, t);
  });

  // 4 passes share the same derived path — only read, no extra computation
  const outerHalo  = useAnimatedProps(() => ({ d: pathD.value }));
  const midGlow    = useAnimatedProps(() => ({ d: pathD.value }));
  const innerGlow  = useAnimatedProps(() => ({ d: pathD.value }));
  const core       = useAnimatedProps(() => ({ d: pathD.value }));

  const gradId = `lg-${config.id}`;

  return (
    <>
      {/* Pass 1 — outermost halo (wide + very faint) */}
      <AnimatedPath
        animatedProps={outerHalo}
        stroke={`url(#${gradId})`}
        strokeWidth={18}
        strokeOpacity={0.12}
        fill="none"
        strokeLinecap="round"
      />
      {/* Pass 2 — mid glow */}
      <AnimatedPath
        animatedProps={midGlow}
        stroke={`url(#${gradId})`}
        strokeWidth={9}
        strokeOpacity={0.28}
        fill="none"
        strokeLinecap="round"
      />
      {/* Pass 3 — inner bright ring */}
      <AnimatedPath
        animatedProps={innerGlow}
        stroke={`url(#${gradId})`}
        strokeWidth={4}
        strokeOpacity={0.60}
        fill="none"
        strokeLinecap="round"
      />
      {/* Pass 4 — crisp luminous core */}
      <AnimatedPath
        animatedProps={core}
        stroke={`url(#${gradId})`}
        strokeWidth={1.5}
        strokeOpacity={1}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

// Memoised so it never re-renders (purely animated via Reanimated)
const MemoStrandGlow = memo(StrandGlow);

// ─── Static SVG defs — memoised, never re-renders ────────────────────────
const SvgDefs = memo(() => (
  <Defs>
    {STRANDS.map((s) => (
      <LinearGradient key={s.id} id={`lg-${s.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
        <Stop offset="0%"   stopColor={s.colorA} stopOpacity={0}   />
        <Stop offset="15%"  stopColor={s.colorA} stopOpacity={1}   />
        <Stop offset="50%"  stopColor={s.colorB} stopOpacity={1}   />
        <Stop offset="85%"  stopColor={s.colorA} stopOpacity={1}   />
        <Stop offset="100%" stopColor={s.colorA} stopOpacity={0}   />
      </LinearGradient>
    ))}
  </Defs>
));

// ─── Main export ──────────────────────────────────────────────────────────
interface StrandsBackgroundProps {
  width: number;
  height: number;
  opacity?: number;
}

export default function StrandsBackground({
  width,
  height,
  opacity = 0.35,
}: StrandsBackgroundProps) {
  // Single shared clock for all strands — only ONE Reanimated animation total
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      progress.value = 0;
    };
  }, []);

  if (width === 0 || height === 0) return null;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { opacity }]}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <SvgDefs />
        {STRANDS.map((strand) => (
          <MemoStrandGlow
            key={strand.id}
            config={strand}
            width={width}
            height={height}
            progress={progress}
          />
        ))}
      </Svg>
    </View>
  );
}
