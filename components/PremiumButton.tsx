import React from 'react';
import { Text, Pressable } from 'react-native';
import { MotiView } from 'moti';

interface PremiumButtonProps {
  title: string;
  onPress?: () => void;
  className?: string;
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({ title, onPress, className = "" }) => {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
    >
      <Pressable
        onPress={onPress}
        className={`bg-brand-primary py-4 px-8 rounded-2xl active:opacity-80 flex-row justify-center items-center shadow-lg ${className}`}
      >
        <Text className="text-white font-bold text-lg">{title}</Text>
      </Pressable>
    </MotiView>
  );
};
