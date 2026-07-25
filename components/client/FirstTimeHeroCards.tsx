import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Target, Award, X } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import MagicRings from '../ui/MagicRings';

interface FirstTimeHeroCardsProps {
  clientName: string;
}

export const FirstTimeHeroCards = ({ clientName }: FirstTimeHeroCardsProps) => {
  const [showTasks, setShowTasks] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);

  useEffect(() => {
    const checkState = async () => {
      const tasksDismissed = await AsyncStorage.getItem('@client_hero_tasks_dismissed');
      const challengeDismissed = await AsyncStorage.getItem('@client_hero_challenge_dismissed');
      
      if (!tasksDismissed) setShowTasks(true);
      if (!challengeDismissed) setShowChallenge(true);
    };
    checkState();
  }, []);

  const dismissTasks = async () => {
    await AsyncStorage.setItem('@client_hero_tasks_dismissed', 'true');
    setShowTasks(false);
  };

  const dismissChallenge = async () => {
    await AsyncStorage.setItem('@client_hero_challenge_dismissed', 'true');
    setShowChallenge(false);
  };

  if (!showTasks && !showChallenge) return null;

  return (
    <View style={{ gap: 16, marginBottom: 24 }}>
      <AnimatePresence>
        {showTasks && (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            className="bg-blue-600 rounded-[32px] p-6 shadow-xl shadow-blue-500/20 relative overflow-hidden"
          >
            {/* Animated MagicRings in background */}
            <View style={{ ...StyleSheet.absoluteFillObject, opacity: 0.4 }} pointerEvents="none">
              <MagicRings
                color="#60a5fa"
                colorTwo="#1d4ed8"
                backgroundColor="#2563eb"
                ringCount={5}
                speed={0.7}
                attenuation={8}
                lineThickness={2}
                baseRadius={0.3}
                radiusStep={0.12}
                followMouse={false}
                clickBurst={false}
              />
            </View>
            <View className="flex-row items-center gap-3 mb-4">
              <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                <Target size={20} color="white" />
              </View>
              <Text className="text-white text-lg font-black tracking-tight flex-1">Your Daily Tasks</Text>
            </View>
            <Text className="text-white/90 text-sm font-medium leading-6 mb-6">
              {clientName}, here are your Daily Tasks set by your coach. Mark them complete every day to lock in your execution consistency!
            </Text>
            <TouchableOpacity 
              onPress={dismissTasks}
              className="bg-white rounded-full py-3.5 items-center justify-center shadow-md"
            >
              <Text className="text-blue-600 font-black text-sm uppercase tracking-widest">Got It</Text>
            </TouchableOpacity>
          </MotiView>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChallenge && !showTasks && ( // Show challenge card only after tasks card is dismissed to avoid clutter
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            className="bg-emerald-600 rounded-[32px] p-6 shadow-xl shadow-emerald-500/20"
          >
            <View className="flex-row items-center gap-3 mb-4">
              <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                <Award size={20} color="white" />
              </View>
              <Text className="text-white text-lg font-black tracking-tight flex-1">Your Challenge Hub</Text>
              <TouchableOpacity onPress={dismissChallenge} className="w-8 h-8 bg-black/10 rounded-full items-center justify-center">
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
            <Text className="text-white/90 text-sm font-medium leading-6">
              Stay sharp. Based on your progress, your coach can launch custom 3-to-14 day challenges to break plateaus. Keep an eye out!
            </Text>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
};
