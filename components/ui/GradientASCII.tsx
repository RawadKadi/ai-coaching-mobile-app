import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Path,
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
   * 'horizon': Arched luminous horizon curve on top (default)
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
   * Inverts the background vertically (horizon glow on bottom instead of top).
   * Used when buttons and form inputs are positioned at the top.
   */
  inverted?: boolean;
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

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const nr = Math.max(0, Math.round(r * (1 - amount)));
  const ng = Math.max(0, Math.round(g * (1 - amount)));
  const nb = Math.max(0, Math.round(b * (1 - amount)));
  return `rgb(${nr}, ${ng}, ${nb})`;
}

export function GradientASCII({
  colors: customColors,
  shape = 'horizon',
  softness = 0.5,
  scale = 1,
  flow = 0.6,
  speed = 1.3,
  glow = 0.45,
  inverted = false,
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
        vivid: customColors[customColors.length - 1],
      };
    }

    const primary = brandColors.primary || '#3b82f6';
    const primaryPressed = brandColors.primaryPressed || primary;
    const accent = brandColors.accent || lighten(primary, 0.4);

    return {
      base: brandColors.background || '#090b10',
      glow: primary,
      mid: lighten(primary, 0.45),
      highlight: lighten(primary, 0.85),
      vivid: primary,
      shadow: darken(primary, 0.55),
      accent: accent,
    };
  }, [customColors, brandColors]);

  // Screen and Bleed Calculations
  // Oversizing by 30% guarantees that when scaling, rotating, or drifting,
  // NO edges or blank spaces ever appear on any phone screen.
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const w = screenWidth || 390;
  const h = screenHeight || 844;

  const bleedX = Math.round(w * 0.3);
  const bleedY = Math.round(h * 0.3);
  const totalW = w + bleedX * 2;
  const totalH = h + bleedY * 2;

  // Horizon Arch Coordinates (colored gradient on top, arching across middle)
  const archYEdge = bleedY + h * 0.44;
  const archYCenter = bleedY + h * 0.52;

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

    // Increased pace: lively undulating tempo for smooth fluid waves
    const duration = Math.max(1500, 3200 / speed);

    // Organic swaying drift
    driftX.value = withRepeat(
      withSequence(
        withTiming(18 * flow, { duration: duration * 0.85, easing: Easing.inOut(Easing.sin) }),
        withTiming(-18 * flow, { duration: duration * 1.15, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    driftY.value = withRepeat(
      withSequence(
        withTiming(-14 * flow, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(14 * flow, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Subtle breathing scale
    waveScale.value = withRepeat(
      withSequence(
        withTiming(1 + 0.06 * flow, { duration: duration * 1.2, easing: Easing.inOut(Easing.quad) }),
        withTiming(1 - 0.04 * flow, { duration: duration * 1.0, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Gentle luminous glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(glow * 1.25, { duration: duration * 0.75, easing: Easing.inOut(Easing.sin) }),
        withTiming(glow * 0.85, { duration: duration * 0.85, easing: Easing.inOut(Easing.sin) })
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
        { translateX: -driftX.value * 0.65 },
        { translateY: -driftY.value * 0.65 },
        { scale: (2 - waveScale.value) * scale },
      ],
      opacity: glowPulse.value * 0.8,
    };
  });

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.container, style]}
      pointerEvents="none"
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          inverted ? styles.inverted : undefined,
        ]}
      >
        {/* SHAPE RENDERING */}
      {shape === 'horizon' && (
        <>
          {/* Main Atmospheric & Gradient Layer (Bleed oversized) */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: -bleedX,
                top: -bleedY,
                width: totalW,
                height: totalH,
              },
              animatedLayerStyle,
            ]}
          >
            <Svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
              <Defs>
                {/* Luminous Sun Bloom centered in upper half */}
                <RadialGradient
                  id="horizonSun"
                  cx="50%"
                  cy={`${((bleedY + h * 0.18) / totalH) * 100}%`}
                  rx="60%"
                  ry="45%"
                >
                  <Stop offset="0%" stopColor={palette.highlight} stopOpacity="0.85" />
                  <Stop offset="25%" stopColor={palette.vivid} stopOpacity="0.65" />
                  <Stop offset="55%" stopColor={palette.glow} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
                </RadialGradient>

                {/* Sky Wash from Top down to Horizon Arch */}
                <LinearGradient id="horizonSky" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={palette.vivid} stopOpacity="0.45" />
                  <Stop offset="30%" stopColor={palette.vivid} stopOpacity="0.75" />
                  <Stop offset="65%" stopColor={palette.mid} stopOpacity="0.85" />
                  <Stop offset="92%" stopColor={palette.highlight} stopOpacity="0.95" />
                  <Stop offset="100%" stopColor={palette.vivid} stopOpacity="0.7" />
                </LinearGradient>

                {/* Soft Diffusion Falloff Below Horizon */}
                <LinearGradient id="horizonFalloff" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={palette.vivid} stopOpacity="0.4" />
                  <Stop offset="40%" stopColor={palette.glow} stopOpacity="0.18" />
                  <Stop offset="80%" stopColor={palette.base} stopOpacity="0.05" />
                  <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
                </LinearGradient>

                {/* White-Hot Horizon Rim Line */}
                <LinearGradient id="horizonRim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={palette.vivid} stopOpacity="0" />
                  <Stop offset="15%" stopColor={palette.vivid} stopOpacity="0.6" />
                  <Stop offset="40%" stopColor={palette.highlight} stopOpacity="0.9" />
                  <Stop offset="50%" stopColor="#ffffff" stopOpacity="0.98" />
                  <Stop offset="60%" stopColor={palette.highlight} stopOpacity="0.9" />
                  <Stop offset="85%" stopColor={palette.vivid} stopOpacity="0.6" />
                  <Stop offset="100%" stopColor={palette.vivid} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* 1. Atmospheric Sun Bloom across upper screen */}
              <Rect x="0" y="0" width={totalW} height={totalH} fill="url(#horizonSun)" />

              {/* 2. Top Colored Sky Fill (covers from very top down to the curved arch) */}
              <Path
                d={`M 0,0 L ${totalW},0 L ${totalW},${archYEdge} Q ${totalW * 0.5},${archYCenter} 0,${archYEdge} Z`}
                fill="url(#horizonSky)"
              />

              {/* 3. Soft Diffusion bleeding down below the arch */}
              <Path
                d={`M 0,${archYEdge} Q ${totalW * 0.5},${archYCenter} ${totalW},${archYEdge} L ${totalW},${bleedY + h * 0.72} L 0,${bleedY + h * 0.72} Z`}
                fill="url(#horizonFalloff)"
              />

              {/* 4. Glowing Horizon Crest Rim */}
              <Path
                d={`M 0,${archYEdge} Q ${totalW * 0.5},${archYCenter} ${totalW},${archYEdge}`}
                fill="none"
                stroke="url(#horizonRim)"
                strokeWidth={mixSoftness(3, 7, softness)}
              />
            </Svg>
          </Animated.View>

          {/* Secondary Organic Wavering Rim for depth */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: -bleedX,
                top: -bleedY,
                width: totalW,
                height: totalH,
              },
              secondaryAnimatedStyle,
            ]}
          >
            <Svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
              <Defs>
                <LinearGradient id="secondaryWave" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="10%" stopColor={palette.highlight} stopOpacity="0" />
                  <Stop offset="45%" stopColor="#ffffff" stopOpacity="0.7" />
                  <Stop offset="55%" stopColor="#ffffff" stopOpacity="0.7" />
                  <Stop offset="90%" stopColor={palette.highlight} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Path
                d={`M 0,${archYEdge - 3} Q ${totalW * 0.5},${archYCenter - 5} ${totalW},${archYEdge - 3}`}
                fill="none"
                stroke="url(#secondaryWave)"
                strokeWidth={2}
              />
            </Svg>
          </Animated.View>
        </>
      )}

      {shape === 'pinch' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -bleedX,
              top: -bleedY,
              width: totalW,
              height: totalH,
            },
            animatedLayerStyle,
          ]}
        >
          <Svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
            <Defs>
              <RadialGradient
                id="pinchCenter"
                cx="50%"
                cy="50%"
                rx="55%"
                ry="22%"
              >
                <Stop offset="0%" stopColor={palette.highlight} stopOpacity="0.9" />
                <Stop offset="40%" stopColor={palette.vivid} stopOpacity="0.6" />
                <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Pinched waist band across center */}
            <Path
              d={`M 0,${bleedY + h * 0.32} Q ${totalW * 0.5},${bleedY + h * 0.44} ${totalW},${bleedY + h * 0.32} L ${totalW},${bleedY + h * 0.68} Q ${totalW * 0.5},${bleedY + h * 0.56} 0,${bleedY + h * 0.68} Z`}
              fill="url(#pinchCenter)"
            />
          </Svg>
        </Animated.View>
      )}

      {shape === 'rise' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -bleedX,
              top: -bleedY,
              width: totalW,
              height: totalH,
            },
            animatedLayerStyle,
          ]}
        >
          <Svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
            <Defs>
              <RadialGradient
                id="riseAtmosphere"
                cx="50%"
                cy="10%"
                rx="75%"
                ry="55%"
              >
                <Stop offset="0%" stopColor={palette.highlight} stopOpacity="0.85" />
                <Stop offset="30%" stopColor={palette.vivid} stopOpacity="0.65" />
                <Stop offset="65%" stopColor={palette.glow} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={totalW} height={totalH} fill="url(#riseAtmosphere)" />
          </Svg>
        </Animated.View>
      )}

      {shape === 'eclipse' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: -bleedX,
              top: -bleedY,
              width: totalW,
              height: totalH,
            },
            animatedLayerStyle,
          ]}
        >
          <Svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
            <Defs>
              <RadialGradient
                id="eclipseHalo"
                cx="50%"
                cy={`${((bleedY + h * 0.35) / totalH) * 100}%`}
                rx="45%"
                ry="45%"
              >
                <Stop offset="55%" stopColor={palette.vivid} stopOpacity="0.05" />
                <Stop offset="75%" stopColor={palette.highlight} stopOpacity="0.8" />
                <Stop offset="88%" stopColor={palette.vivid} stopOpacity="0.45" />
                <Stop offset="100%" stopColor={palette.base} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle
              cx={totalW * 0.5}
              cy={bleedY + h * 0.35}
              r={w * 0.48}
              fill="url(#eclipseHalo)"
            />
          </Svg>
        </Animated.View>
      )}
      </View>
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
  inverted: {
    transform: [{ scaleY: -1 }],
  },
});

export default GradientASCII;
