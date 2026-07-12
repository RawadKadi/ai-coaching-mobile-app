import { useBrandColors } from '@/contexts/BrandContext';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Check, Shield } from 'lucide-react-native';
import { MotiView } from 'moti';

interface CardOptionProps {
  label: string;
  desc: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  activeColor?: string;
}

export default function CardOption({ label, desc, icon, selected, onSelect, activeColor = colors.primary }: CardOptionProps) {
  const colors = useBrandColors();
  return (
    <TouchableOpacity 
      onPress={onSelect}
      className={`p-6 rounded-[32px] border-2 flex-row items-center justify-between transition-all ${
        selected ? 'bg-slate-900 border-blue-600/50' : 'bg-slate-900/30 border-slate-900'
      }`}
    >
      <View className="flex-row items-center gap-5 flex-1">
        <View style={selected ? { backgroundColor: activeColor + '20' } : {}} className={`w-14 h-14 rounded-2xl items-center justify-center ${selected ? '' : 'bg-slate-950 border border-slate-800'}`}>
          {icon || <Shield size={20} color={selected ? activeColor : '#475569'} />}
        </View>
        <View className="flex-1">
          <Text className={`text-lg font-black ${selected ? 'text-white' : 'text-slate-400'}`}>{label}</Text>
          <Text className={`text-xs font-bold ${selected ? 'text-slate-500' : 'text-slate-600'}`}>{desc}</Text>
        </View>
      </View>
      {selected && (
        <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-500/50">
          <Check size={14} color="white" strokeWidth={4} />
        </MotiView>
      )}
    </TouchableOpacity>
  );
}
