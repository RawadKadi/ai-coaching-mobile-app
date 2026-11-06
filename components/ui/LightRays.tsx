'use client';

import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export type RaysOrigin =
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'right'
  | 'left'
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left';

export interface LightRaysProps {
  raysOrigin?: RaysOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  rayDensity?: number;
  tilt?: number;
  raySharpness?: number;
  glow?: number;
  haze?: number;
  atmosphere?: number;
  intensity?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  cursorShadow?: boolean;
  clickPulse?: boolean;
  noiseAmount?: number;
  distortion?: number;
  intro?: boolean;
  lightMode?: boolean;
  opacity?: number;
  maxDevicePixelRatio?: number;
  className?: string;
  style?: StyleProp<ViewStyle> | any;
}

interface Origin {
  anchor: number[];
  dir: number[];
}

const ORIGINS: Record<RaysOrigin, Origin> = {
  'top-left': { anchor: [0, -0.2], dir: [0, 1] },
  'top-center': { anchor: [0.5, -0.2], dir: [0, 1] },
  'top-right': { anchor: [1, -0.2], dir: [0, 1] },
  left: { anchor: [-0.2, 0.5], dir: [1, 0] },
  right: { anchor: [1.2, 0.5], dir: [-1, 0] },
  'bottom-left': { anchor: [0, 1.2], dir: [0, -1] },
  'bottom-center': { anchor: [0.5, 1.2], dir: [0, -1] },
  'bottom-right': { anchor: [1, 1.2], dir: [0, -1] },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseColor = (value: string): number[] => {
  const text = String(value || '').trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, (digit) => digit + digit) : hex[1];
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((channel) => clamp(parseFloat(channel) / 255, 0, 1));
  return [1, 1, 1];
};

export default function LightRays({
  raysOrigin = 'top-center',
  raysColor = '#ffffff',
  raysSpeed = 1,
  lightSpread = 0.5,
  rayLength = 3,
  rayDensity = 1,
  tilt = 0,
  raySharpness = 0.35,
  glow = 0.6,
  haze = 0.25,
  atmosphere = 1,
  intensity = 1,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
  followMouse = true,
  mouseInfluence = 0.1,
  cursorShadow = true,
  clickPulse = true,
  noiseAmount = 0,
  distortion = 0,
  intro = true,
  lightMode = false,
  opacity = 1,
  maxDevicePixelRatio = 2,
  className = '',
  style,
}: LightRaysProps) {
  const parsedColor = useMemo(() => parseColor(raysColor), [raysColor]);
  const origin = ORIGINS[raysOrigin] || ORIGINS['top-center'];

  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent !important;
      -webkit-user-select: none;
      user-select: none;
    }
    #container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      width: 100%; height: 100%;
      overflow: hidden;
      pointer-events: none;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      background: transparent !important;
    }
  </style>
</head>
<body>
  <div id="container">
    <canvas id="glcanvas"></canvas>
  </div>
  <script>
    const PIXEL_BUDGET = 2.4e6;
    const MAX_PULSES = 4;

    const ORIGIN = ${JSON.stringify(origin)};
    const COLOR = [${parsedColor.join(', ')}];
    const SPEED = ${Math.max(0, raysSpeed)};
    const SPREAD = ${Math.max(0.001, lightSpread)};
    const LENGTH = ${Math.max(0.01, rayLength)};
    const DENSITY = ${clamp(rayDensity, 0.1, 6)};
    const TILT = ${(clamp(tilt, -90, 90) * Math.PI) / 180};
    const SHARPNESS = ${clamp(raySharpness, 0, 1)};
    const GLOW = ${Math.max(0, glow)};
    const HAZE = ${clamp(haze, 0, 1)};
    const ATMOSPHERE = ${clamp(atmosphere, 0, 1)};
    const INTENSITY = ${Math.max(0, intensity)};
    const PULSATING = ${pulsating ? 1 : 0};
    const FADE = ${Math.max(0.01, fadeDistance)};
    const SATURATION = ${Math.max(0, saturation)};
    const FOLLOW = ${followMouse ? 'true' : 'false'};
    const INFLUENCE = ${clamp(mouseInfluence, 0, 1)};
    const CURSOR_SHADOW = ${cursorShadow ? 'true' : 'false'};
    const CLICK_PULSE = ${clickPulse ? 'true' : 'false'};
    const NOISE = ${clamp(noiseAmount, 0, 1)};
    const DISTORTION = ${distortion};
    const INTRO = ${intro ? 'true' : 'false'};
    const LIGHT = ${lightMode ? 1 : 0};
    const OPACITY = ${clamp(opacity, 0, 1)};
    const MAX_RATIO = ${clamp(maxDevicePixelRatio, 0.5, 3)};

    const VERTEX = \`#version 300 es
    const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
    void main() {
      gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
    }\`;

    const FRAGMENT = \`#version 300 es
    precision highp float;
    uniform vec2 uResolution;
    uniform float uScale;
    uniform float uTime;
    uniform vec2 uSource;
    uniform vec2 uAim;
    uniform float uReach;
    uniform vec3 uColor;
    uniform float uSpread;
    uniform float uLength;
    uniform float uFade;
    uniform float uSaturation;
    uniform float uPulsating;
    uniform float uNoise;
    uniform float uDistortion;
    uniform float uDensity;
    uniform float uSharpness;
    uniform float uGlow;
    uniform float uHaze;
    uniform float uAtmosphere;
    uniform float uIntensity;
    uniform vec4 uShadow;
    uniform vec4 uPulses[4];
    uniform vec2 uIntro;
    uniform float uLight;
    uniform float uOpacity;
    out vec4 fragColor;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = p - i;
      vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
    }

    float shape(float strength, float width) {
      float edge = max(mix(0.5, 0.08, uSharpness), width);
      return mix(strength, smoothstep(0.62 - edge, 0.62 + edge, strength), uSharpness);
    }

    void main() {
      vec2 coord = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uScale;
      vec2 delta = coord - uSource;
      float distance = length(delta);
      vec2 dir = delta / max(distance, 1e-4);
      float cosAngle = dot(dir, uAim);
      float angle = cosAngle + uDistortion * sin(uTime * 2.0 + distance * 0.02) * 0.2;
      float slope = fwidth(angle);
      float depth = distance / uReach;

      float source = exp(-depth * depth * 9.0) * 0.9 + exp(-depth * 3.2) * 0.25;
      float glowLight = uGlow * source * smoothstep(-0.2, 0.6, cosAngle);
      float spread = pow(max(angle, 0.0), 1.0 / uSpread);
      float lengthFalloff = clamp(1.0 - distance / (uReach * uLength), 0.0, 1.0);
      float fadeFalloff = clamp(1.0 - distance / (uReach * uFade), 0.5, 1.0);
      float envelope = spread * lengthFalloff * fadeFalloff;
      float reveal = uIntensity * uIntro.y * (1.0 - smoothstep(uIntro.x - 0.35, uIntro.x, depth));
      if ((envelope * 1.6 + glowLight) * reveal < 0.0015) {
        fragColor = vec4(0.0);
        return;
      }

      float phaseA = angle * 36.2214 * uDensity + uTime * 1.5;
      float phaseB = -angle * 21.11349 * uDensity + uTime * 1.5;
      float phaseC = angle * 22.3991 * uDensity + uTime * 1.1;
      float phaseD = -angle * 18.0234 * uDensity + uTime * 1.1;
      float strengthA = clamp(0.75 + 0.15 * sin(phaseA) + 0.2 * cos(phaseB), 0.0, 1.0);
      float strengthB = clamp(0.75 + 0.15 * sin(phaseC) + 0.2 * cos(phaseD), 0.0, 1.0);
      float widthA = abs(0.15 * 36.2214 * cos(phaseA) + 0.2 * 21.11349 * sin(phaseB)) * uDensity * slope;
      float widthB = abs(0.15 * 22.3991 * cos(phaseC) + 0.2 * 18.0234 * sin(phaseD)) * uDensity * slope;
      float pulseA = uPulsating > 0.5 ? 0.8 + 0.2 * sin(uTime * 4.5) : 1.0;
      float pulseB = uPulsating > 0.5 ? 0.8 + 0.2 * sin(uTime * 3.3) : 1.0;
      float rayLight = envelope * (0.5 * shape(strengthA, widthA) * pulseA + 0.4 * shape(strengthB, widthB) * pulseB);

      if (uHaze > 0.0) {
        float around = atan(uAim.x * dir.y - uAim.y * dir.x, cosAngle);
        vec2 drift = vec2(around * 2.2 + uTime * 0.035, depth * 2.6 - uTime * 0.11);
        float fog = 0.65 * valueNoise(drift * vec2(3.0, 1.0)) + 0.35 * valueNoise(drift * vec2(7.0, 2.3) + 4.1);
        rayLight *= mix(1.0, 0.25 + 1.2 * fog, uHaze);
      }

      if (uShadow.z > 0.0) {
        vec2 toCursor = uShadow.xy - uSource;
        float cursorDistance = length(toCursor);
        float along = dot(delta, toCursor) / max(cursorDistance * cursorDistance, 1e-4);
        float side = abs(delta.x * toCursor.y - delta.y * toCursor.x) / max(cursorDistance, 1e-4);
        float trail = max(along - 1.0, 0.0);
        float width = uShadow.w * along + 0.22 * trail * cursorDistance;
        float behind = smoothstep(0.97, 1.25, along) * exp(-trail * 1.1);
        float shade = (1.0 - smoothstep(width * 0.3, width * 1.6, side)) * behind;
        rayLight *= 1.0 - uShadow.z * 0.62 * shade;
      }

      float boost = 0.0;
      for (int i = 0; i < 4; i++) {
        vec4 wave = uPulses[i];
        if (wave.z <= 0.0) continue;
        float x = (depth - wave.x) / wave.y;
        boost += wave.z * exp(-x * x);
      }
      float light = (rayLight * (1.0 + boost) + glowLight) * reveal;

      if (uNoise > 0.0) {
        float n = fract(sin(dot(coord * 0.02 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453123);
        light *= 1.0 - uNoise + uNoise * n;
      }

      float near = clamp(1.2 - distance / (uResolution.y / uScale), 0.0, 1.0);
      vec3 tint = mix(vec3(0.9), vec3(0.1, 0.3, 0.5) + near * vec3(0.8, 0.6, 0.5), uAtmosphere);
      float gray = dot(tint, vec3(0.299, 0.587, 0.114));
      vec3 hue = max(mix(vec3(gray), tint, uSaturation), 0.0) * uColor;

      float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
      if (uLight > 0.5) {
        vec3 color = hue * light;
        float energy = max(color.r, max(color.g, color.b));
        vec3 tone = clamp(1.0 - (1.0 - hue / max(max(hue.r, max(hue.g, hue.b)), 1e-4)) * 1.8, 0.0, 1.0);
        float warm = clamp((min(tone.r, tone.g) - tone.b) * 2.0, 0.0, 1.0);
        vec3 ink = tone * (mix(0.66, 0.94, warm) - 0.1 * smoothstep(0.4, 1.2, energy));
        float density = clamp(0.82 * (1.0 - exp(-1.5 * energy * energy)) * uOpacity + grain, 0.0, 1.0);
        fragColor = vec4(ink * density, density);
        return;
      }
      float level = light < 0.75 ? light : 0.75 + 0.25 * (1.0 - exp(-(light - 0.75) / 0.25));
      float top = max(hue.r, max(hue.g, hue.b));
      hue = mix(hue, vec3(top), smoothstep(0.8, 1.0, level) * 0.45);
      vec3 shown = clamp(hue * level, 0.0, 1.0) * level;
      fragColor = vec4(clamp(shown + grain, 0.0, level) * uOpacity, level * uOpacity);
    }\`;

    const clampFn = (v, min, max) => Math.min(max, Math.max(min, v));
    const smoother = (t) => {
      const x = clampFn(t, 0, 1);
      return x * x * x * (x * (x * 6 - 15) + 10);
    };

    const canvas = document.getElementById('glcanvas');
    const container = document.getElementById('container');
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    });

    if (gl) {
      function compile(type, source) {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error(gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vertex = compile(gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
      let program = null;
      if (vertex && fragment) {
        program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
      }

      if (program && gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const uniforms = {};
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < count; i++) {
          const info = gl.getActiveUniform(program, i);
          if (info) uniforms[info.name.replace(/\\[0\\]$/, '')] = gl.getUniformLocation(program, info.name);
        }

        const vao = gl.createVertexArray();
        const size = { width: 1, height: 1, ratio: 1 };
        const pointer = { x: 0.5, y: 0.5, inside: false, seen: false };
        const aim = { x: 0.5, y: 0.5 };
        const shade = { x: 0.5, y: 0.5, presence: 0 };
        const pulses = [];
        const pulseData = new Float32Array(MAX_PULSES * 4);
        let time = 0;
        let opening = INTRO ? 0 : 1;
        let raf = 0;
        let last = 0;

        const resize = () => {
          const rect = container.getBoundingClientRect();
          const cssWidth = Math.max(1, rect.width || window.innerWidth);
          const cssHeight = Math.max(1, rect.height || window.innerHeight);
          const detail = DENSITY * (0.35 + 0.65 * SHARPNESS);
          const sampling = Math.max(clampFn(0.35 + 0.3 * detail, 0.5, 2), NOISE > 0 ? 1 : 0);
          const ratio = Math.min(
            window.devicePixelRatio || 1,
            MAX_RATIO,
            sampling,
            Math.sqrt(PIXEL_BUDGET / (cssWidth * cssHeight))
          );
          const width = Math.max(1, Math.round(cssWidth * ratio));
          const height = Math.max(1, Math.round(cssHeight * ratio));
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          size.width = cssWidth;
          size.height = cssHeight;
          size.ratio = width / cssWidth;
        };

        const frame = (now) => {
          raf = 0;
          const dt = clampFn((now - last) / 1000 || 0, 0, 0.05);
          last = Math.max(last, now);
          time += dt * SPEED;
          if (opening < 1) opening = Math.min(1, opening + dt / 1.8);

          const steer = 1 - Math.exp(-dt / 0.2);
          const aimX = FOLLOW && pointer.seen ? pointer.x : 0.5;
          const aimY = FOLLOW && pointer.seen ? pointer.y : 0.5;
          aim.x += (aimX - aim.x) * steer;
          aim.y += (aimY - aim.y) * steer;

          const glide = 1 - Math.exp(-dt / 0.08);
          shade.x += (pointer.x - shade.x) * glide;
          shade.y += (pointer.y - shade.y) * glide;
          const shading = pointer.inside && CURSOR_SHADOW;
          shade.presence += ((shading ? 1 : 0) - shade.presence) * (1 - Math.exp(-dt / (shading ? 0.25 : 0.5)));

          for (let index = pulses.length - 1; index >= 0; index--) {
            pulses[index].age += dt;
            if (pulses[index].age >= 2) pulses.splice(index, 1);
          }
          pulseData.fill(0);
          pulses.forEach((pulse, index) => {
            const t = pulse.age;
            pulseData[index * 4] = 0.05 + t * 1.05;
            pulseData[index * 4 + 1] = 0.14 + t * 0.14;
            pulseData[index * 4 + 2] = 0.9 * smoother(t / 0.15) * (1 - smoother(t / 2));
          });

          const width = size.width;
          const height = size.height;
          const sourceX = ORIGIN.anchor[0] * width;
          const sourceY = ORIGIN.anchor[1] * height;
          const cos = Math.cos(TILT);
          const sin = Math.sin(TILT);
          let dirX = ORIGIN.dir[0] * cos - ORIGIN.dir[1] * sin;
          let dirY = ORIGIN.dir[0] * sin + ORIGIN.dir[1] * cos;
          if (FOLLOW && INFLUENCE > 0) {
            const mx = aim.x * width - sourceX;
            const my = aim.y * height - sourceY;
            const ml = Math.hypot(mx, my) || 1;
            const bx = dirX + (mx / ml - dirX) * INFLUENCE;
            const by = dirY + (my / ml - dirY) * INFLUENCE;
            const bl = Math.hypot(bx, by) || 1;
            dirX = bx / bl;
            dirY = by / bl;
          }
          const eased = 1 - Math.pow(1 - opening, 3);

          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(program);
          gl.bindVertexArray(vao);
          gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
          gl.uniform1f(uniforms.uScale, size.ratio);
          gl.uniform1f(uniforms.uTime, time);
          gl.uniform2f(uniforms.uSource, sourceX, sourceY);
          gl.uniform2f(uniforms.uAim, dirX, dirY);
          gl.uniform1f(uniforms.uReach, Math.max(width, height));
          gl.uniform3f(uniforms.uColor, COLOR[0], COLOR[1], COLOR[2]);
          gl.uniform1f(uniforms.uSpread, SPREAD);
          gl.uniform1f(uniforms.uLength, LENGTH);
          gl.uniform1f(uniforms.uFade, FADE);
          gl.uniform1f(uniforms.uSaturation, SATURATION);
          gl.uniform1f(uniforms.uPulsating, PULSATING);
          gl.uniform1f(uniforms.uNoise, NOISE);
          gl.uniform1f(uniforms.uDistortion, DISTORTION);
          gl.uniform1f(uniforms.uDensity, DENSITY);
          gl.uniform1f(uniforms.uSharpness, SHARPNESS);
          gl.uniform1f(uniforms.uGlow, GLOW);
          gl.uniform1f(uniforms.uHaze, HAZE);
          gl.uniform1f(uniforms.uAtmosphere, ATMOSPHERE);
          gl.uniform1f(uniforms.uIntensity, INTENSITY);
          gl.uniform4f(uniforms.uShadow, shade.x * width, shade.y * height, shade.presence, 16);
          gl.uniform4fv(uniforms.uPulses, pulseData);
          gl.uniform2f(uniforms.uIntro, eased * 2.6, smoother(opening / 0.5));
          gl.uniform1f(uniforms.uLight, LIGHT);
          gl.uniform1f(uniforms.uOpacity, OPACITY);
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          raf = requestAnimationFrame(frame);
        };

        window.addEventListener('resize', () => {
          resize();
        });
        resize();
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }
  </script>
</body>
</html>
    `;
  }, [
    origin,
    parsedColor,
    raysSpeed,
    lightSpread,
    rayLength,
    rayDensity,
    tilt,
    raySharpness,
    glow,
    haze,
    atmosphere,
    intensity,
    pulsating,
    fadeDistance,
    saturation,
    followMouse,
    mouseInfluence,
    cursorShadow,
    clickPulse,
    noiseAmount,
    distortion,
    intro,
    lightMode,
    opacity,
    maxDevicePixelRatio,
  ]);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          overflow: 'hidden',
          backgroundColor: 'transparent',
        },
        style,
      ]}
      pointerEvents="none"
    >
      <WebView
        source={{ html: htmlContent }}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'transparent',
          },
        ]}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        pointerEvents="none"
        bounces={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        containerStyle={{ backgroundColor: 'transparent' }}
        androidLayerType={(Platform.OS === 'android' ? 'hardware' : undefined) as any}
      />
    </View>
  );
}
