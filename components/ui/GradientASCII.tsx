import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Path,
  G,
  Circle,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useBrandColors } from '@/contexts/BrandContext';

export type GradientASCIIShape = 'horizon' | 'pinch' | 'rise' | 'eclipse';

export interface GradientASCIIProps {
  /**
   * Two to eight colors for the light, from the edge to brightest point.
   * If not provided, dynamically adapts to current app brand colors.
   */
  colors?: string[];
  /**
   * Shape of the light effect.
   * 'horizon': Arched luminous horizon curve (default)
   * 'pinch': Squeezed band of light across the center
   * 'rise': Atmospheric light glowing upward from the bottom
   * 'eclipse': Outer radiant corona ring
   */
  shape?: GradientASCIIShape;
  /**
   * Softness of the shape edges (0 to 1).
   */
  softness?: number;
  /**
   * Size of the shape (0.4 to 2.5).
   */
  scale?: number;
  /**
   * How much the light wavers as it drifts (0 to 2).
   */
  flow?: number;
  /**
   * Speed of the drift. 0 holds shape still.
   */
  speed?: number;
  /**
   * Soft glow intensity (0 to 1.5).
   */
  glow?: number;
  /**
   * Optional custom style override.
   */
  style?: ViewStyle;
  /**
   * Extra className if used on web.
   */
  className?: string;
}

// Color manipulation helpers
function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length < 6) return [59, 130, 246]; // fallback
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return [59, 130, 246];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const nr = Math.min(255, Math.round(r + (255 - r) * amount));
  const ng = Math.min(255, Math.round(g + (255 - g) * amount));
  const nb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export function GradientASCII({
  colors: customColors,
  shape = 'horizon',
  softness = 0.5,
  scale = 1,
  flow = 0.5,
  speed = 1,
  glow = 0.35,
  style,
}: GradientASCIIProps) {
  const brandColors = useBrandColors();
  const prefersReducedMotion = useReducedMotion();

  // Generate dynamic brand color ramp if custom colors are not provided
  const palette = useMemo(() => {
    if (customColors && customColors.length >= 2) {
      return {
        base: customColors[0],
        glow: customColors[1],
        mid: customColors[2] || customColors[1],
        highlight: customColors[customColors.length - 1],
      };
    }

    const primary = brandColors.primary || '#3b82f6';
    const primaryPressed = brandColors.primaryPressed || primary;
    const accent = brandColors.accent || lighten(primary, 0.4);

    return {
      base: brandColors.background || '#090b10',
      glow: primary,
      mid: primaryPressed,
      highlight: lighten(primary, 0.55),
      accent: accent,
    };
  }, [customColors, brandColors]);

  // Animation values
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const waveScale = useSharedValue(1);
  const glowPulse = useSharedValue(glow);

  useEffect(() => {
    if (prefersReducedMotion || speed <= 0) {
      driftX.value = 0;
      driftY.value = 0;
      waveScale.value = 1;
      glowPulse.value = glow;
      return;
    }

    const duration = Math.max(3000, 7000 / speed);

    // Organic swaying drift
    driftX.value = withRepeat(
      withSequence(
        withTiming(18 * flow, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) }),
        withTiming(-18 * flow, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    driftY.value = withRepeat(
      withSequence(
        withTiming(-14 * flow, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
        withTiming(14 * flow, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Subtle breathing scale
    waveScale.value = withRepeat(
      withSequence(
        withTiming(1 + 0.06 * flow, { duration: duration * 1.3, easing: Easing.inOut(Easing.quad) }),
        withTiming(1 - 0.04 * flow, { duration: duration * 1.1, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Gentle luminous glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(glow * 1.25, { duration: duration * 0.7, easing: Easing.inOut(Easing.sin) }),
        withTiming(glow * 0.85, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [speed, flow, glow, prefersReducedMotion]);

  const animatedLayerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: driftX.value },
        { translateY: driftY.value },
        { scale: waveScale.value * scale },
      ],
      opacity: glowPulse.value,
    };
  });

  const secondaryAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: -driftX.value * 0.6 },
        { translateY: -driftY.value * 0.5 },
        { scale: (2 - waveScale.value) * scale },
      ],
      opacity: glowPulse.value * 0.75,
    };
  });

  // Calculate width/height proportions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const w = screenWidth || 400;
  const h = screenHeight || 800;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.container, style]}
      pointerEvents="none"
    >
      {/* BASE BACKGROUND FADE */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} />

      {/* SHAPE RENDERING */}
      {shape === 'horizon' && (
        <>
          {/* Deep Ambient Sun & Atmosphere */}
          <Animated.View style={[StyleSheet.absoluteFill, animatedLayerStyle]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
              <Defs>
                <RadialGradient
                  id="horizonSun"
                  cx="50%"
                  cy="52%"
                  rx="65%"
                  ry="45%"
                  fx="50%"
                  fy="50%"
                >
                  <Stop offset="0%" stopColor={palette.glow} stopOpacity="0.45" />
                  <Stop offset="35%" stopColor={palette.mid} stopOpacity="0.25" />
                  <Stop offset="70%" stopColor={palette.glow} stopOpacity="0.08" />
                  <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
                </RadialGradient>

                <LinearGradient id="horizonGlowBar" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={palette.highlight} stopOpacity="0.9" />
                  <Stop offset="25%" stopColor={palette.glow} stopOpacity="0.7" />
                  <Stop offset="65%" stopColor={palette.mid} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Atmospheric central radiance */}
              <Rect x="0" y="0" width={w} height={h} fill="url(#horizonSun)" />

              {/* Luminous Arched Horizon Curve */}
              <Path
                d={`M -40,${h * 0.52} Q ${w * 0.5},${h * 0.44} ${w + 40},${h * 0.52} L ${w + 40},${h} L -40,${h} Z`}
                fill="url(#horizonGlowBar)"
              />
            </Svg>
          </Animated.View>

          {/* Secondary Organic Wavering Edge for depth */}
          <Animated.View style={[StyleSheet.absoluteFill, secondaryAnimatedStyle]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
              <Defs>
                <LinearGradient id="horizonWave" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={palette.glow} stopOpacity="0" />
                  <Stop offset="30%" stopColor={palette.highlight} stopOpacity="0.5" />
                  <Stop offset="50%" stopColor="#ffffff" stopOpacity="0.75" />
                  <Stop offset="70%" stopColor={palette.highlight} stopOpacity="0.5" />
                  <Stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Fine glowing crest line of the horizon */}
              <Path
                d={`M 0,${h * 0.52} Q ${w * 0.5},${h * 0.44} ${w},${h * 0.52}`}
                fill="none"
                stroke="url(#horizonWave)"
                strokeWidth={mixSoftness(2, 6, softness)}
              />
            </Svg>
          </Animated.View>
        </>
      )}

      {shape === 'pinch' && (
        <Animated.View style={[StyleSheet.absoluteFill, animatedLayerStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
            <Defs>
              <RadialGradient
                id="pinchCenter"
                cx="50%"
                cy="50%"
                rx="50%"
                ry="20%"
                fx="50%"
                fy="50%"
              >
                <Stop offset="0%" stopColor={palette.highlight} stopOpacity="0.85" />
                <Stop offset="40%" stopColor={palette.glow} stopOpacity="0.5" />
                <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="pinchSideLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={palette.glow} stopOpacity="0.7" />
                <Stop offset="100%" stopColor={palette.glow} stopOpacity="0.2" />
              </LinearGradient>
            </Defs>

            {/* Pinched waist band */}
            <Path
              d={`M 0,${h * 0.38} Q ${w * 0.5},${h * 0.48} ${w},${h * 0.38} L ${w},${h * 0.62} Q ${w * 0.5},${h * 0.52} 0,${h * 0.62} Z`}
              fill="url(#pinchCenter)"
            />
          </Svg>
        </Animated.View>
      )}

      {shape === 'rise' && (
        <Animated.View style={[StyleSheet.absoluteFill, animatedLayerStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
            <Defs>
              <RadialGradient
                id="riseAtmosphere"
                cx="50%"
                cy="95%"
                rx="80%"
                ry="55%"
                fx="50%"
                fy="100%"
              >
                <Stop offset="0%" stopColor={palette.highlight} stopOpacity="0.8" />
                <Stop offset="30%" stopColor={palette.glow} stopOpacity="0.55" />
                <Stop offset="65%" stopColor={palette.mid} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={w} height={h} fill="url(#riseAtmosphere)" />
          </Svg>
        </Animated.View>
      )}

      {shape === 'eclipse' && (
        <Animated.View style={[StyleSheet.absoluteFill, animatedLayerStyle]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
            <Defs>
              <RadialGradient
                id="eclipseHalo"
                cx="50%"
                cy="46%"
                rx="48%"
                ry="48%"
                fx="50%"
                fy="46%"
              >
                <Stop offset="60%" stopColor={palette.glow} stopOpacity="0.05" />
                <Stop offset="78%" stopColor={palette.highlight} stopOpacity="0.75" />
                <Stop offset="88%" stopColor={palette.glow} stopOpacity="0.4" />
                <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={w * 0.5} cy={h * 0.46} r={w * 0.46} fill="url(#eclipseHalo)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

function mixSoftness(min: number, max: number, softness: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, softness));
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    zIndex: 0,
  },
});

export default GradientASCII;
