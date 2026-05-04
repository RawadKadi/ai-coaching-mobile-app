import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { ChevronDown, Clock, Check } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';

interface BrandedDurationPickerProps {
  value: number;
  onSelect: (value: number) => void;
  label?: string;
}

export const BrandedDurationPicker: React.FC<BrandedDurationPickerProps> = ({ value, onSelect, label = "Duration" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = Array.from({ length: 12 }, (_, i) => i + 3); // 3-14 days

  return (
    <View>
      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-3 ml-1">{label}</Text>
      
      <TouchableOpacity 
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
        className="h-20 bg-slate-900 border border-white/5 rounded-[28px] px-8 flex-row items-center justify-between shadow-2xl shadow-black/40"
      >
        <View className="flex-row items-center gap-4">
          <View className="w-10 h-10 bg-blue-600/10 rounded-xl items-center justify-center border border-blue-600/20">
            <Clock size={20} color="#3B82F6" />
          </View>
          <View>
            <Text className="text-white font-black text-xl">{value} Days</Text>
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Protocol Length</Text>
          </View>
        </View>
        <ChevronDown size={20} color="#475569" />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setIsOpen(false)}
          className="flex-1 bg-black/80 justify-end"
        >
          <View className="bg-slate-950 rounded-t-[48px] border-t border-white/10 p-8 pb-12 max-h-[60%]">
            <View className="flex-row justify-between items-center mb-8">
              <View>
                <Text className="text-white text-2xl font-black">Select Duration</Text>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-1">Days Range: 3-14</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsOpen(false)}
                className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/10"
              >
                <Text className="text-slate-400 font-bold">Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-3">
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      onSelect(opt);
                      setIsOpen(false);
                    }}
                    className={`flex-1 min-w-[30%] h-16 rounded-2xl border items-center justify-center ${value === opt ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-white/5'}`}
                  >
                    <View className="flex-row items-center gap-2">
                        <Text className={`text-xl font-black ${value === opt ? 'text-white' : 'text-slate-400'}`}>{opt}</Text>
                        {value === opt && <Check size={14} color="white" />}
                    </View>
                    <Text className={`text-[8px] font-black uppercase tracking-widest ${value === opt ? 'text-blue-200' : 'text-slate-600'}`}>Days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
