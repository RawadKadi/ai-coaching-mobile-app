/**
 * StrandsBackground
 *
 * Native React Native recreation of the WebGL Strands glow animation.
 *
 * Animation strategy:
 *   Uses a plain requestAnimationFrame loop + React state to update SVG path
 *   strings at 60 fps. Reanimated is NOT used for path animation because its
 *   worklet path for string props is not frame-continuous — it causes the
 *   "moves-stops-moves" jitter seen when animating SVG `d` strings.
 *
 * Glow strategy (3-pass per strand):
 *   1. Wide blurred halo   — feGaussianBlur stdDeviation=8, thick stroke
 *   2. Tighter mid-bloom   — feGaussianBlur stdDeviation=3, medium stroke
 *   3. Crisp bright core   — no filter, thin stroke
 *
 * Brand colours: Blue-500 (#3B82F6) · Indigo-400 (#818CF8) · Purple-600 (#7C3AED)
 */

import React, { useEffect, useRef, useState, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg';

// ─── Strand definitions ────────────────────────────────────────────────────
interface StrandConfig {
  id: string;
  yFraction: number;  // 0–1 vertical centre as fraction of height
  amplitude: number;  // wave height as fraction of height
  wavelength: number; // wave width as fraction of width
  phase: number;      // radians phase offset
  speed: number;      // radians/second
  colorMid: string;
  colorEdge: string;
}

const STRANDS: StrandConfig[] = [
  {
    id: 's0',
    yFraction: 0.30,
    amplitude: 0.14,
    wavelength: 0.70,
    phase: 0,
    speed: 0.55,
    colorMid: '#3B82F6',
    colorEdge: '#6366F1',
  },
  {
    id: 's1',
    yFraction: 0.50,
    amplitude: 0.11,
    wavelength: 0.85,
    phase: 1.5,
    speed: 0.38,
    colorMid: '#818CF8',
    colorEdge: '#7C3AED',
  },
  {
    id: 's2',
    yFraction: 0.70,
    amplitude: 0.10,
    wavelength: 0.60,
    phase: 2.9,
    speed: 0.68,
    colorMid: '#60A5FA',
    colorEdge: '#3B82F6',
  },
];

// ─── Wave path builder (plain JS — runs on JS thread in rAF loop) ──────────
function buildWavePath(
  width: number,
  height: number,
  strand: StrandConfig,
  elapsedSec: number,
): string {
  const baseY = strand.yFraction * height;
  const amp   = strand.amplitude  * height;
  const wl    = strand.wavelength * width;
  const SEGS  = 12; // more segments = smoother curve
  const segW  = width / SEGS;

  const evalY = (x: number) =>
    baseY + amp * Math.sin(
      (2 * Math.PI * x) / wl + strand.phase + elapsedSec * strand.speed,
    );

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

// ─── Static SVG defs (gradients + filters) ────────────────────────────────
// Extracted into its own memo component so it never re-renders.
const SvgDefs = memo(() => (
  <Defs>
    {STRANDS.map((s) => (
      <LinearGradient key={`lg-${s.id}`} id={`lg-${s.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
        <Stop offset="0%"   stopColor={s.colorMid}  stopOpacity={0}   />
        <Stop offset="15%"  stopColor={s.colorMid}  stopOpacity={1}   />
        <Stop offset="50%"  stopColor={s.colorEdge} stopOpacity={1}   />
        <Stop offset="85%"  stopColor={s.colorMid}  stopOpacity={1}   />
        <Stop offset="100%" stopColor={s.colorMid}  stopOpacity={0}   />
      </LinearGradient>
    ))}

    {/* Outer halo — wide soft bloom */}
    <Filter id="glow-outer" x="-50%" y="-500%" width="200%" height="1100%">
      <FeGaussianBlur stdDeviation="9" result="blur" />
    </Filter>

    {/* Mid bloom — tighter bright ring */}
    <Filter id="glow-mid" x="-25%" y="-250%" width="150%" height="600%">
      <FeGaussianBlur stdDeviation="3.5" result="blur" />
    </Filter>
  </Defs>
));

// ─── Strand renderer (pure — only re-renders when its paths change) ────────
interface StrandRowProps {
  strand: StrandConfig;
  d: string;
}

const StrandRow = memo(({ strand, d }: StrandRowProps) => (
  <React.Fragment>
    {/* Pass 1: outer halo */}
    <Path
      d={d}
      stroke={`url(#lg-${strand.id})`}
      strokeWidth={20}
      strokeOpacity={0.65}
      fill="none"
      strokeLinecap="round"
      filter="url(#glow-outer)"
    />
    {/* Pass 2: mid bloom */}
    <Path
      d={d}
      stroke={`url(#lg-${strand.id})`}
      strokeWidth={8}
      strokeOpacity={0.88}
      fill="none"
      strokeLinecap="round"
      filter="url(#glow-mid)"
    />
    {/* Pass 3: crisp core */}
    <Path
      d={d}
      stroke={`url(#lg-${strand.id})`}
      strokeWidth={1.8}
      strokeOpacity={1}
      fill="none"
      strokeLinecap="round"
    />
  </React.Fragment>
));

// ─── Main export ───────────────────────────────────────────────────────────
interface StrandsBackgroundProps {
  width: number;
  height: number;
  opacity?: number;
}

export default function StrandsBackground({
  width,
  height,
  opacity = 0.38,
}: StrandsBackgroundProps) {
  // One path string per strand, updated at 60 fps via rAF
  const [paths, setPaths] = useState<string[]>(() => STRANDS.map(() => ''));
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef     = useRef<number>(0);

  useEffect(() => {
    if (width === 0 || height === 0) return;

    // Seed initial paths immediately (avoids one blank frame)
    setPaths(STRANDS.map((s) => buildWavePath(width, height, s, 0)));

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = (now - startTimeRef.current) / 1000; // seconds

      setPaths(STRANDS.map((s) => buildWavePath(width, height, s, elapsed)));

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      startTimeRef.current = null;
    };
  }, [width, height]);

  if (width === 0 || height === 0) return null;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { opacity }]}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <SvgDefs />
        {STRANDS.map((strand, i) => (
          <StrandRow
            key={strand.id}
            strand={strand}
            d={paths[i] || ''}
          />
        ))}
      </Svg>
    </View>
  );
}
