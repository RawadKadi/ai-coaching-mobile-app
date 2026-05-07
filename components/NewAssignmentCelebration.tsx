import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { PartyPopper, UserPlus, Check, Award, Sparkles } from 'lucide-react-native';
import { useBrandColors } from '@/contexts/BrandContext';

const { width, height } = Dimensions.get('window');

interface NewAssignmentCelebrationProps {
  visible: boolean;
  isFirstClient: boolean;
  clientName?: string;
  onClose: () => void;
}

export function NewAssignmentCelebration({
  visible,
  isFirstClient,
  clientName,
  onClose,
}: NewAssignmentCelebrationProps) {
  const { primary } = useBrandColors();

  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={[StyleSheet.absoluteFillObject, { zIndex: 1000, backgroundColor: 'rgba(2, 6, 23, 0.95)' }]}
          className="items-center justify-center p-8"
        >
          <MotiView
            from={{ scale: 0.5, opacity: 0, translateY: 50 }}
            animate={{ scale: 1, opacity: 1, translateY: 0 }}
            exit={{ scale: 0.5, opacity: 0, translateY: 50 }}
            transition={{ type: 'spring', damping: 15 }}
            className="items-center w-full"
          >
            <View className="w-24 h-24 bg-blue-600 rounded-full items-center justify-center mb-8 shadow-2xl shadow-blue-500/50">
              {isFirstClient ? (
                <Award size={48} color="white" />
              ) : (
                <UserPlus size={48} color="white" />
              )}
            </View>

            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 300 }}
              className="items-center"
            >
              <Text className="text-blue-500 font-black text-xs uppercase tracking-[4px] mb-2">New Strategic Assignment</Text>
              <Text className="text-white text-4xl font-black text-center tracking-tighter mb-4 leading-tight">
                {isFirstClient ? "Your First Client!" : "New Client Assigned"}
              </Text>
              
              <View className="bg-white/5 px-6 py-4 rounded-[24px] border border-white/10 mb-8 items-center">
                <Text className="text-slate-400 text-sm font-medium mb-1">
                  {isFirstClient ? "Congratulations! You've officially started your coaching journey with" : "You've been assigned to lead"}
                </Text>
                <Text className="text-white text-2xl font-black tracking-tight">{clientName || "a new athlete"}</Text>
              </View>

              <Text className="text-slate-500 text-center text-base font-medium px-6 mb-10 leading-6">
                {isFirstClient 
                  ? "This is a major milestone. Let's make a massive impact and show what you're capable of."
                  : "Another athlete added to your command. Time to drive results and maintain the standard."}
              </Text>

              <TouchableOpacity
                onPress={onClose}
                className="h-16 px-12 bg-blue-600 rounded-full flex-row items-center gap-3 shadow-2xl shadow-blue-500/40 border border-white/10"
              >
                <Sparkles size={20} color="white" />
                <Text className="text-white font-black text-lg tracking-tight">Let's Get Started</Text>
              </TouchableOpacity>
            </MotiView>
          </MotiView>

          {/* Background Sparkles */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none" className="opacity-20">
             {[...Array(6)].map((_, i) => (
               <MotiView
                 key={i}
                 from={{ opacity: 0, scale: 0, translateY: 0 }}
                 animate={{ opacity: 1, scale: 1, translateY: -20 }}
                 transition={{ 
                   loop: true, 
                   duration: 2000 + (i * 500),
                   delay: i * 300,
                   type: 'timing'
                 }}
                 style={{ 
                   position: 'absolute', 
                   top: `${Math.random() * 100}%`, 
                   left: `${Math.random() * 100}%` 
                 }}
               >
                 <Sparkles size={24} color={primary} />
               </MotiView>
             ))}
          </View>
        </MotiView>
      )}
    </AnimatePresence>
  );
}
