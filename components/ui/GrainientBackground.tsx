import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface GrainientProps {
  timeSpeed?: number;
  colorBalance?: number;
  warpStrength?: number;
  warpFrequency?: number;
  warpSpeed?: number;
  warpAmplitude?: number;
  blendAngle?: number;
  blendSoftness?: number;
  rotationAmount?: number;
  noiseScale?: number;
  grainAmount?: number;
  grainScale?: number;
  grainAnimated?: boolean;
  contrast?: number;
  gamma?: number;
  saturation?: number;
  centerX?: number;
  centerY?: number;
  zoom?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  width?: number;
  height?: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
};

export default function GrainientBackground({
  timeSpeed = 0.25,
  colorBalance = 0.0,
  warpStrength = 1.0,
  warpFrequency = 5.0,
  warpSpeed = 2.0,
  warpAmplitude = 50.0,
  blendAngle = 0.0,
  blendSoftness = 0.05,
  rotationAmount = 500.0,
  noiseScale = 2.0,
  grainAmount = 0.0, // Disabled grain as requested
  grainScale = 0.2,
  grainAnimated = false,
  contrast = 1.5,
  gamma = 1.0,
  saturation = 1.0,
  centerX = 0.0,
  centerY = 0.0,
  zoom = 0.9,
  color1 = '#000000',
  color2 = '#5227FF',
  color3 = '#000000',
}: GrainientProps) {
  
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const [r3, g3, b3] = hexToRgb(color3);

  // We inject the exact WebGL shader code provided, but wrap it in vanilla WebGL2
  // since `ogl` isn't available inside the WebView out of the box without a bundler.
  const htmlContent = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${color3}; }
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
    uniform vec2 iResolution;
    uniform float iTime;
    uniform float uTimeSpeed;
    uniform float uColorBalance;
    uniform float uWarpStrength;
    uniform float uWarpFrequency;
    uniform float uWarpSpeed;
    uniform float uWarpAmplitude;
    uniform float uBlendAngle;
    uniform float uBlendSoftness;
    uniform float uRotationAmount;
    uniform float uNoiseScale;
    uniform float uGrainAmount;
    uniform float uGrainScale;
    uniform float uGrainAnimated;
    uniform float uContrast;
    uniform float uGamma;
    uniform float uSaturation;
    uniform vec2 uCenterOffset;
    uniform float uZoom;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    out vec4 fragColor;
    #define S(a,b,t) smoothstep(a,b,t)
    mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);} 
    vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);} 
    float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
    void mainImage(out vec4 o, vec2 C){
      float t=iTime*uTimeSpeed;
      vec2 uv=C/iResolution.xy;
      float ratio=iResolution.x/iResolution.y;
      vec2 tuv=uv-0.5+uCenterOffset;
      tuv/=max(uZoom,0.001);

      float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
      tuv.y*=1.0/ratio;
      tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
      tuv.y*=ratio;

      float frequency=uWarpFrequency;
      float ws=max(uWarpStrength,0.001);
      float amplitude=uWarpAmplitude/ws;
      float warpTime=t*uWarpSpeed;
      tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
      tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

      vec3 colLav=uColor1;
      vec3 colOrg=uColor2;
      vec3 colDark=uColor3;
      float b=uColorBalance;
      float s=max(uBlendSoftness,0.0);
      mat2 blendRot=Rot(radians(uBlendAngle));
      float blendX=(tuv*blendRot).x;
      float edge0=-0.3-b-s;
      float edge1=0.2-b+s;
      float v0=0.5-b+s;
      float v1=-0.3-b-s;
      vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
      vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
      vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

      vec2 grainUv=uv*max(uGrainScale,0.001);
      if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} 
      float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
      col+=(grain-0.5)*uGrainAmount;

      col=(col-0.5)*uContrast+0.5;
      float luma=dot(col,vec3(0.2126,0.7152,0.0722));
      col=mix(vec3(luma),col,uSaturation);
      col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
      col=clamp(col,0.0,1.0);

      o=vec4(col,1.0);
    }
    void main(){
      vec4 o=vec4(0.0);
      mainImage(o,gl_FragCoord.xy);
      fragColor=o;
    }\`;

    const canvas = document.getElementById('glcanvas');
    const gl = canvas.getContext('webgl2');

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
      // Full screen triangle
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
         3.0, -1.0,
        -1.0,  3.0
      ]), gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        iResolution: gl.getUniformLocation(program, 'iResolution'),
        iTime: gl.getUniformLocation(program, 'iTime'),
        uTimeSpeed: gl.getUniformLocation(program, 'uTimeSpeed'),
        uColorBalance: gl.getUniformLocation(program, 'uColorBalance'),
        uWarpStrength: gl.getUniformLocation(program, 'uWarpStrength'),
        uWarpFrequency: gl.getUniformLocation(program, 'uWarpFrequency'),
        uWarpSpeed: gl.getUniformLocation(program, 'uWarpSpeed'),
        uWarpAmplitude: gl.getUniformLocation(program, 'uWarpAmplitude'),
        uBlendAngle: gl.getUniformLocation(program, 'uBlendAngle'),
        uBlendSoftness: gl.getUniformLocation(program, 'uBlendSoftness'),
        uRotationAmount: gl.getUniformLocation(program, 'uRotationAmount'),
        uNoiseScale: gl.getUniformLocation(program, 'uNoiseScale'),
        uGrainAmount: gl.getUniformLocation(program, 'uGrainAmount'),
        uGrainScale: gl.getUniformLocation(program, 'uGrainScale'),
        uGrainAnimated: gl.getUniformLocation(program, 'uGrainAnimated'),
        uContrast: gl.getUniformLocation(program, 'uContrast'),
        uGamma: gl.getUniformLocation(program, 'uGamma'),
        uSaturation: gl.getUniformLocation(program, 'uSaturation'),
        uCenterOffset: gl.getUniformLocation(program, 'uCenterOffset'),
        uZoom: gl.getUniformLocation(program, 'uZoom'),
        uColor1: gl.getUniformLocation(program, 'uColor1'),
        uColor2: gl.getUniformLocation(program, 'uColor2'),
        uColor3: gl.getUniformLocation(program, 'uColor3')
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
      
      function render(t) {
        gl.useProgram(program);
        
        gl.uniform2f(uniforms.iResolution, canvas.width, canvas.height);
        gl.uniform1f(uniforms.iTime, (t - t0) * 0.001);
        
        // Feed in all the props
        gl.uniform1f(uniforms.uTimeSpeed, ${timeSpeed});
        gl.uniform1f(uniforms.uColorBalance, ${colorBalance});
        gl.uniform1f(uniforms.uWarpStrength, ${warpStrength});
        gl.uniform1f(uniforms.uWarpFrequency, ${warpFrequency});
        gl.uniform1f(uniforms.uWarpSpeed, ${warpSpeed});
        gl.uniform1f(uniforms.uWarpAmplitude, ${warpAmplitude});
        gl.uniform1f(uniforms.uBlendAngle, ${blendAngle});
        gl.uniform1f(uniforms.uBlendSoftness, ${blendSoftness});
        gl.uniform1f(uniforms.uRotationAmount, ${rotationAmount});
        gl.uniform1f(uniforms.uNoiseScale, ${noiseScale});
        gl.uniform1f(uniforms.uGrainAmount, ${grainAmount});
        gl.uniform1f(uniforms.uGrainScale, ${grainScale});
        gl.uniform1f(uniforms.uGrainAnimated, ${grainAnimated ? 1.0 : 0.0});
        gl.uniform1f(uniforms.uContrast, ${contrast});
        gl.uniform1f(uniforms.uGamma, ${gamma});
        gl.uniform1f(uniforms.uSaturation, ${saturation});
        gl.uniform2f(uniforms.uCenterOffset, ${centerX}, ${centerY});
        gl.uniform1f(uniforms.uZoom, ${zoom});
        
        gl.uniform3f(uniforms.uColor1, ${r1}, ${g1}, ${b1});
        gl.uniform3f(uniforms.uColor2, ${r2}, ${g2}, ${b2});
        gl.uniform3f(uniforms.uColor3, ${r3}, ${g3}, ${b3});

        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    }
  </script>
</body>
</html>
  `, [timeSpeed, colorBalance, warpStrength, warpFrequency, warpSpeed, warpAmplitude, blendAngle, blendSoftness, rotationAmount, noiseScale, grainAmount, grainScale, grainAnimated, contrast, gamma, saturation, centerX, centerY, zoom, r1, g1, b1, r2, g2, b2, r3, g3, b3, color3]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <WebView
        source={{ html: htmlContent }}
        style={StyleSheet.absoluteFillObject}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        pointerEvents="none"
        bounces={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        // Transparent webview background to avoid white flashes
        containerStyle={{ backgroundColor: 'transparent' }}
        androidLayerType="hardware"
      />
    </View>
  );
}
