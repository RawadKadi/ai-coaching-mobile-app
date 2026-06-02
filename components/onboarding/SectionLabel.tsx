import React from 'react';
import { View, Text } from 'react-native';

interface SectionLabelProps {
  step: string;
  title: string;
  desc: string;
}

export default function SectionLabel({ step, title, desc }: SectionLabelProps) {
  return (
    <View className="mb-2">
      <Text className="text-blue-500 font-bold text-xs uppercase tracking-[3px] mb-1">{step}</Text>
      <Text className="text-white text-4xl font-black tracking-tight">{title}</Text>
      <Text className="text-slate-500 font-bold mt-2 text-base leading-6">{desc}</Text>
    </View>
  );
}
