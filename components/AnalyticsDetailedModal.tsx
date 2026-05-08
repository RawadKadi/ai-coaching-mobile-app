import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, PanResponder } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Line, Circle } from 'react-native-svg';
import { X, TrendingUp, Users, Award } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsData {
  date: string;
  total_roster: number;
  high_performers: number;
}

interface AnalyticsDetailedModalProps {
  visible: boolean;
  onClose: () => void;
  data: AnalyticsData[];
  currentActive: number;
}

export const AnalyticsDetailedModal: React.FC<AnalyticsDetailedModalProps> = ({ 
  visible, 
  onClose, 
  data,
  currentActive
}) => {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartWidth = SCREEN_WIDTH - 48;
  const chartHeight = 250;
  const padding = 10;

  // Calculate scales
  const stats = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 10, range: 10 };
    const allValues = data.flatMap(d => [d.total_roster, d.high_performers]);
    const min = 0; // Always start from 0 for stacked area
    const max = Math.max(...allValues, 5) * 1.2;
    return { min, max, range: max - min };
  }, [data]);

  const points = useMemo(() => {
    if (data.length < 2) return { roster: [], performers: [] };
    
    return {
      roster: data.map((d, i) => ({
        x: (i / (data.length - 1)) * chartWidth,
        y: chartHeight - ((d.total_roster - stats.min) / stats.range) * chartHeight
      })),
      performers: data.map((d, i) => ({
        x: (i / (data.length - 1)) * chartWidth,
        y: chartHeight - ((d.high_performers - stats.min) / stats.range) * chartHeight
      }))
    };
  }, [data, stats, chartWidth, chartHeight]);

  const paths = useMemo(() => {
    if (points.roster.length < 2) return { rosterLine: '', rosterArea: '', performersLine: '', performersArea: '' };

    const rosterLine = points.roster.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const performersLine = points.performers.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return {
      rosterLine,
      rosterArea: `${rosterLine} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`,
      performersLine,
      performersArea: `${performersLine} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`
    };
  }, [points, chartWidth, chartHeight]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const index = Math.round((x / chartWidth) * (data.length - 1));
      const safeIndex = Math.max(0, Math.min(data.length - 1, index));
      
      if (safeIndex !== activeIndex) {
        setActiveIndex(safeIndex);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    onPanResponderRelease: () => setActiveIndex(null),
    onPanResponderTerminate: () => setActiveIndex(null),
  });

  const activeData = activeIndex !== null ? data[activeIndex] : null;
  
  // Calculate growth
  const growth = useMemo(() => {
    if (data.length < 2) return 0;
    const start = data[0].total_roster;
    const end = data[data.length - 1].total_roster;
    if (start === 0) return end > 0 ? 100 : 0;
    return Math.round(((end - start) / start) * 100);
  }, [data]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-slate-950" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="px-6 py-8 flex-row justify-between items-center">
          <View>
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mb-2">Detailed Analytics</Text>
            <Text className="text-white text-3xl font-black tracking-tighter">Active Performance</Text>
          </View>
          <TouchableOpacity 
            onPress={onClose}
            className="w-12 h-12 bg-slate-900 rounded-full items-center justify-center border border-white/5"
          >
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Hero Stats */}
        <View className="px-6 flex-row gap-4 mb-10">
          <View className="flex-1 bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
            <View className="flex-row items-center gap-2 mb-2">
              <Users size={14} color="#3B82F6" />
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Roster</Text>
            </View>
            <Text className="text-white text-3xl font-black">{data[data.length - 1]?.total_roster || 0}</Text>
          </View>
          <View className="flex-1 bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
            <View className="flex-row items-center gap-2 mb-2">
              <Award size={14} color="#A855F7" />
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">High Performers</Text>
            </View>
            <Text className="text-white text-3xl font-black">{data[data.length - 1]?.high_performers || 0}</Text>
          </View>
        </View>

        {/* Chart Container */}
        <View className="px-6 flex-1">
          <View className="bg-slate-900/20 rounded-[40px] border border-white/5 p-6 h-[350px] justify-center overflow-hidden">
            <View {...panResponder.panHandlers} className="relative">
              <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {/* Horizontal Grid Lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <Line
                    key={i}
                    x1="0"
                    y1={(chartHeight / 4) * i}
                    x2={chartWidth}
                    y2={(chartHeight / 4) * i}
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    opacity={0.05}
                  />
                ))}

                <Defs>
                  <LinearGradient id="fillRoster" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.05" />
                    <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
                  </LinearGradient>
                  <LinearGradient id="fillPerformers" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#A855F7" stopOpacity="0.1" />
                    <Stop offset="100%" stopColor="#A855F7" stopOpacity="0.02" />
                  </LinearGradient>
                </Defs>

                {/* Layer 1: Total Roster */}
                <Path d={paths.rosterArea} fill="url(#fillRoster)" />
                <Path d={paths.rosterLine} fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" opacity={0.5} />

                {/* Layer 2: High Performers */}
                <Path d={paths.performersArea} fill="url(#fillPerformers)" />
                <Path d={paths.performersLine} fill="none" stroke="#A855F7" strokeWidth="3" />

                {/* Scrubber Line */}
                {activeIndex !== null && (
                  <>
                    <Line 
                      x1={points.roster[activeIndex].x} 
                      y1="0" 
                      x2={points.roster[activeIndex].x} 
                      y2={chartHeight} 
                      stroke="white" 
                      strokeWidth="1" 
                      opacity={0.3} 
                    />
                    <Circle 
                      cx={points.performers[activeIndex].x} 
                      cy={points.performers[activeIndex].y} 
                      r="6" 
                      fill="#A855F7" 
                      stroke="white" 
                      strokeWidth="2" 
                    />
                  </>
                )}
              </Svg>
            </View>

            {/* Tooltip Overlay */}
            <AnimatePresence>
              {activeData && (
                <MotiView 
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: 10 }}
                  className="absolute top-4 left-6 right-6 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 flex-row justify-between items-center"
                >
                  <View>
                    <Text className="text-white/60 text-[8px] font-black uppercase tracking-widest mb-1">
                      {new Date(activeData.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text className="text-white font-black text-xs">Snapshot Report</Text>
                  </View>
                  <View className="flex-row gap-4">
                    <View className="items-end">
                      <Text className="text-blue-400 text-[10px] font-black uppercase">Total</Text>
                      <Text className="text-white font-black text-lg">{activeData.total_roster}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-purple-400 text-[10px] font-black uppercase">Active</Text>
                      <Text className="text-white font-black text-lg">{activeData.high_performers}</Text>
                    </View>
                  </View>
                </MotiView>
              )}
            </AnimatePresence>
          </View>

          {/* Legend */}
          <View className="flex-row justify-center gap-8 mt-8">
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full bg-blue-500/50 border border-blue-400" />
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Growth</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full bg-purple-600 border border-purple-400" />
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">High Performers</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="px-6 py-10 border-t border-white/5 bg-slate-900/20">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-emerald-500/10 rounded-full items-center justify-center border border-emerald-500/20">
              <TrendingUp size={20} color="#10B981" />
            </View>
            <View>
              <Text className="text-white font-black text-sm tracking-tight">Trending up by {growth}% this month</Text>
              <Text className="text-slate-500 text-[10px] font-medium uppercase tracking-widest">Last 30 Days Growth Velocity</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={onClose}
            className="mt-8 bg-blue-600 py-5 rounded-[24px] items-center justify-center shadow-lg shadow-blue-500/30"
          >
            <Text className="text-white font-black text-sm uppercase tracking-[2px]">Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
