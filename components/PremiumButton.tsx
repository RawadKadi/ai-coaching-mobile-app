import React from 'react';
import { Text, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { styled } from 'nativewind';

interface PremiumButtonProps {
  title: string;
  onPress?: () => void;
  className?: string;
}

const StyledPressable = styled(Pressable);

export const PremiumButton: React.FC<PremiumButtonProps> = ({ title, onPress, className = "" }) => {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
    >
      <StyledPressable
        onPress={onPress}
        className={`bg-brand-primary py-4 px-8 rounded-2xl active:opacity-80 flex-row justify-center items-center shadow-lg ${className}`}
      >
        <Text className="text-white font-bold text-lg">{title}</Text>
      </StyledPressable>
    </MotiView>
  );
};
