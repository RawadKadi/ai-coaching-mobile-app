import React from 'react';
import { View } from 'react-native';
import { Flame, Zap, Activity } from 'lucide-react-native';
import SectionLabel from '../SectionLabel';
import CardOption from './CardOption';

interface Step2Props {
  formData: {
    goal: string;
  };
  updateForm: (key: string, value: any) => void;
}

export default function Step2({ formData, updateForm }: Step2Props) {
  return (
    <View className="gap-8">
      <SectionLabel step="Step 2" title="Goal Selection" desc="What is your main goal?" />
      <View className="gap-4">
        <CardOption 
          label="Lose Weight" 
          desc="Burn fat and get leaner" 
          icon={<Flame size={20} color="#E11D48" />} 
          selected={formData.goal === 'Weight Loss'} 
          onSelect={() => updateForm('goal', 'Weight Loss')} 
          activeColor="#E11D48" 
        />
        <CardOption 
          label="Build Muscle" 
          desc="Gain strength and size" 
          icon={<Zap size={20} color="#F59E0B" />} 
          selected={formData.goal === 'Muscle Gain'} 
          onSelect={() => updateForm('goal', 'Muscle Gain')} 
          activeColor="#F59E0B" 
        />
        <CardOption 
          label="Stay Fit" 
          desc="Maintain weight and feel healthy" 
          icon={<Activity size={20} color="#10B981" />} 
          selected={formData.goal === 'Maintenance'} 
          onSelect={() => updateForm('goal', 'Maintenance')} 
          activeColor="#10B981" 
        />
      </View>
    </View>
  );
}
