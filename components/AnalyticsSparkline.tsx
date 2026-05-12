import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface SparklineData {
  total_roster: number;
  high_performers: number;
}

interface AnalyticsSparklineProps {
  data: SparklineData[];
  heroNumber: number;
  label: string;
  loading?: boolean;
  dataKey?: keyof SparklineData;
}

export const AnalyticsSparkline: React.FC<AnalyticsSparklineProps> = ({ 
  data, 
  heroNumber, 
  label,
  loading = false,
  dataKey = 'total_roster'
}) => {
  if (loading || data.length < 2) {
    return (
      <View className="flex-1 justify-end">
        <Text className="text-white text-4xl font-black tracking-tighter mb-1">{heroNumber}</Text>
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</Text>
        <View className="h-8 border-b border-slate-800 border-dashed mt-2" />
      </View>
    );
  }

  // Extract the specified metric for the sparkline trend
  const values = data.map(d => d[dataKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const width = 100;
  const height = 40;
  const padding = 4; // increased padding so 0 state looks better

  // Map values to coordinates
  const points = values.map((v, i) => {
    let normalizedY = 0;
    if (range === 0) {
       // If all values are the same, draw the line in the middle if > 0, 
       // or at the bottom if 0 (but with padding)
       normalizedY = v === 0 ? 0 : 0.5;
    } else {
       normalizedY = (v - min) / range;
    }

    return {
      x: (i / (values.length - 1)) * width,
      y: height - normalizedY * (height - padding * 2) - padding
    };
  });

  // Create SVG path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View className="flex-1 relative">
      <View className="absolute bottom-0 left-0 right-0 top-0 opacity-60">
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#A855F7" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#A855F7" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d={areaPath}
            fill="url(#grad)"
          />
          <Path
            d={linePath}
            fill="none"
            stroke="#A855F7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
};
