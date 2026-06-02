import React from 'react';
import { View } from 'react-native';
import { Shield, Activity, Zap } from 'lucide-react-native';
import SectionLabel from '../SectionLabel';
import CardOption from './CardOption';

interface Step3Props {
  formData: {
    experience_level: string;
  };
  updateForm: (key: string, value: any) => void;
}

export default function Step3({ formData, updateForm }: Step3Props) {
  return (
    <View className="gap-8">
      <SectionLabel step="Step 3" title="Experience Level" desc="What is your experience level?" />
      <View className="gap-4">
        <CardOption 
          label="Beginner" 
          desc="New to fitness or starting out" 
          icon={<Shield size={20} color="#94A3B8" />} 
          selected={formData.experience_level === 'Beginner'} 
          onSelect={() => updateForm('experience_level', 'Beginner')} 
        />
        <CardOption 
          label="Intermediate" 
          desc="Active and have some experience" 
          icon={<Activity size={20} color="#94A3B8" />} 
          selected={formData.experience_level === 'Intermediate'} 
          onSelect={() => updateForm('experience_level', 'Intermediate')} 
        />
        <CardOption 
          label="Advanced" 
          desc="Very active and experienced" 
          icon={<Zap size={20} color="#3B82F6" />} 
          selected={formData.experience_level === 'Advanced'} 
          onSelect={() => updateForm('experience_level', 'Advanced')} 
          activeColor="#3B82F6" 
        />
      </View>
    </View>
  );
}
