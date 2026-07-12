import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface MagicRingsProps {
  color?: string;
  colorTwo?: string;
  speed?: number;
  ringCount?: number;
  attenuation?: number;
  lineThickness?: number;
  baseRadius?: number;
  radiusStep?: number;
  scaleRate?: number;
  opacity?: number;
  noiseAmount?: number;
  rotation?: number;
  ringGap?: number;
  fadeIn?: number;
  fadeOut?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  hoverScale?: number;
  parallax?: number;
  clickBurst?: boolean;
  backgroundColor?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0.5, 0.5, 0.5];
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
};

export default function MagicRings({
  color = '#fc42ff',
  colorTwo = '#42fcff',
  speed = 1.0,
  ringCount = 6,
  attenuation = 10.0,
  lineThickness = 2.0,
  baseRadius = 0.35,
  radiusStep = 0.1,
  scaleRate = 0.1,
  opacity = 1.0,
  noiseAmount = 0.1,
  rotation = 0.0,
  ringGap = 1.5,
  fadeIn = 0.7,
  fadeOut = 0.5,
  followMouse = false,
  mouseInfluence = 0.2,
  hoverScale = 1.2,
  parallax = 0.05,
  clickBurst = false,
  backgroundColor = 'transparent',
}: MagicRingsProps) {

  const [r1, g1, b1] = hexToRgb(color);
  const [r2, g2, b2] = hexToRgb(colorTwo);

  const htmlContent = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${backgroundColor}; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="glcanvas"></canvas>
  <script>
    const vertex = \`#version 300 es
    in vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }\`;

    const fragment = \`#version 300 es
    precision highp float;

    uniform float uTime, uAttenuation, uLineThickness;
    uniform float uBaseRadius, uRadiusStep, uScaleRate;
    uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
    uniform float uFadeIn, uFadeOut;
    uniform float uMouseInfluence, uHoverAmount, uHoverScale, uParallax, uBurst;
    uniform vec2 uResolution, uMouse;
    uniform vec3 uColor, uColorTwo;
    uniform int uRingCount;

    out vec4 fragColor;

    const float HP = 1.5707963;
    const float CYCLE = 3.45;

    float fade(float t) {
      return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
    }

    float ring(vec2 p, float ri, float cut, float t0, float px) {
      float t = mod(uTime + t0, CYCLE);
      float r = ri + t / CYCLE * uScaleRate;
      float d = abs(length(p) - r);
      float a = atan(abs(p.y), abs(p.x)) / HP;
      float th = max(1.0 - a, 0.5) * px * uLineThickness;
      float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
      d += pow(cut * a, 3.0) * r;
      return h * exp(-uAttenuation * d) * fade(t);
    }

    void main() {
      float px = 1.0 / min(uResolution.x, uResolution.y);
      vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
      float cr = cos(uRotation), sr = sin(uRotation);
      p = mat2(cr, -sr, sr, cr) * p;
      p -= uMouse * uMouseInfluence;
      float sc = mix(1.0, uHoverScale, uHoverAmount) + uBurst * 0.3;
      p /= sc;
      vec3 c = vec3(0.0);
      float rcf = max(float(uRingCount) - 1.0, 1.0);
      for (int i = 0; i < 10; i++) {
        if (i >= uRingCount) break;
        float fi = float(i);
        vec2 pr = p - fi * uParallax * uMouse;
        vec3 rc = mix(uColor, uColorTwo, fi / rcf);
        c = mix(c, rc, vec3(ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px)));
      }
      c *= 1.0 + uBurst * 2.0;
      float alpha = max(c.r, max(c.g, c.b)) * uOpacity;
      float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uNoiseAmount;
      fragColor = vec4(c, alpha);
    }\`;

    const canvas = document.getElementById('glcanvas');
    const gl = canvas.getContext('webgl2', { alpha: true });

    if (!gl) {
      console.error('WebGL 2 not supported');
    } else {
      function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error(gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vertShader = createShader(gl, gl.VERTEX_SHADER, vertex);
      const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragment);

      const program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
         3.0, -1.0,
        -1.0,  3.0
      ]), gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        uTime: gl.getUniformLocation(program, 'uTime'),
        uAttenuation: gl.getUniformLocation(program, 'uAttenuation'),
        uLineThickness: gl.getUniformLocation(program, 'uLineThickness'),
        uBaseRadius: gl.getUniformLocation(program, 'uBaseRadius'),
        uRadiusStep: gl.getUniformLocation(program, 'uRadiusStep'),
        uScaleRate: gl.getUniformLocation(program, 'uScaleRate'),
        uOpacity: gl.getUniformLocation(program, 'uOpacity'),
        uNoiseAmount: gl.getUniformLocation(program, 'uNoiseAmount'),
        uRotation: gl.getUniformLocation(program, 'uRotation'),
        uRingGap: gl.getUniformLocation(program, 'uRingGap'),
        uFadeIn: gl.getUniformLocation(program, 'uFadeIn'),
        uFadeOut: gl.getUniformLocation(program, 'uFadeOut'),
        uMouseInfluence: gl.getUniformLocation(program, 'uMouseInfluence'),
        uHoverAmount: gl.getUniformLocation(program, 'uHoverAmount'),
        uHoverScale: gl.getUniformLocation(program, 'uHoverScale'),
        uParallax: gl.getUniformLocation(program, 'uParallax'),
        uBurst: gl.getUniformLocation(program, 'uBurst'),
        uResolution: gl.getUniformLocation(program, 'uResolution'),
        uMouse: gl.getUniformLocation(program, 'uMouse'),
        uColor: gl.getUniformLocation(program, 'uColor'),
        uColorTwo: gl.getUniformLocation(program, 'uColorTwo'),
        uRingCount: gl.getUniformLocation(program, 'uRingCount')
      };

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      window.addEventListener('resize', resize);
      resize();

      const t0 = performance.now();
      let mouseX = 0;
      let mouseY = 0;
      let targetMouseX = 0;
      let targetMouseY = 0;
      let hoverAmount = 0;
      let isHovered = false;
      let burst = 0;

      window.addEventListener('mousemove', (e) => {
        targetMouseX = (e.clientX / window.innerWidth) - 0.5;
        targetMouseY = -((e.clientY / window.innerHeight) - 0.5);
      });
      window.addEventListener('mouseenter', () => { isHovered = true; });
      window.addEventListener('mouseleave', () => {
        isHovered = false;
        targetMouseX = 0;
        targetMouseY = 0;
      });
      window.addEventListener('click', () => { burst = 1.0; });

      // Support touch input mapping to hover/mouse
      window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          const touch = e.touches[0];
          targetMouseX = (touch.clientX / window.innerWidth) - 0.5;
          targetMouseY = -((touch.clientY / window.innerHeight) - 0.5);
        }
      });
      window.addEventListener('touchstart', () => { isHovered = true; });
      window.addEventListener('touchend', () => {
        isHovered = false;
        targetMouseX = 0;
        targetMouseY = 0;
      });

      function render(t) {
        gl.useProgram(program);

        mouseX += (targetMouseX - mouseX) * 0.08;
        mouseY += (targetMouseY - mouseY) * 0.08;
        hoverAmount += ((isHovered ? 1.0 : 0.0) - hoverAmount) * 0.08;
        burst *= 0.95;
        if (burst < 0.001) burst = 0;

        gl.uniform1f(uniforms.uTime, (t - t0) * 0.001 * ${speed});
        gl.uniform1f(uniforms.uAttenuation, ${attenuation});
        gl.uniform1f(uniforms.uLineThickness, ${lineThickness});
        gl.uniform1f(uniforms.uBaseRadius, ${baseRadius});
        gl.uniform1f(uniforms.uRadiusStep, ${radiusStep});
        gl.uniform1f(uniforms.uScaleRate, ${scaleRate});
        gl.uniform1f(uniforms.uOpacity, ${opacity});
        gl.uniform1f(uniforms.uNoiseAmount, ${noiseAmount});
        gl.uniform1f(uniforms.uRotation, (${rotation} * Math.PI) / 180.0);
        gl.uniform1f(uniforms.uRingGap, ${ringGap});
        gl.uniform1f(uniforms.uFadeIn, ${fadeIn});
        gl.uniform1f(uniforms.uFadeOut, ${fadeOut});
        gl.uniform1f(uniforms.uMouseInfluence, ${followMouse ? mouseInfluence : 0.0});
        gl.uniform1f(uniforms.uHoverAmount, hoverAmount);
        gl.uniform1f(uniforms.uHoverScale, ${hoverScale});
        gl.uniform1f(uniforms.uParallax, ${parallax});
        gl.uniform1f(uniforms.uBurst, ${clickBurst ? 1.0 : 0.0} * burst);

        gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.uMouse, mouseX, mouseY);
        gl.uniform3f(uniforms.uColor, ${r1}, ${g1}, ${b1});
        gl.uniform3f(uniforms.uColorTwo, ${r2}, ${g2}, ${b2});
        gl.uniform1i(uniforms.uRingCount, ${ringCount});

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    }
  </script>
</body>
</html>
  `, [
    color, colorTwo, speed, ringCount, attenuation, lineThickness,
    baseRadius, radiusStep, scaleRate, opacity, noiseAmount,
    rotation, ringGap, fadeIn, fadeOut, followMouse, mouseInfluence,
    hoverScale, parallax, clickBurst, r1, g1, b1, r2, g2, b2, backgroundColor
  ]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <WebView
        source={{ html: htmlContent }}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        pointerEvents="none"
        bounces={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        containerStyle={{ backgroundColor: 'transparent' }}
        androidLayerType="hardware"
      />
    </View>
  );
}
