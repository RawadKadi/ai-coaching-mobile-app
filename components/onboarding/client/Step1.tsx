import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import SectionLabel from '../SectionLabel';
import InputGroup from '../InputGroup';

interface Step1Props {
  formData: {
    date_of_birth: string;
    gender: string;
    height_cm: string;
  };
  updateForm: (key: string, value: any) => void;
}

export default function Step1({ formData, updateForm }: Step1Props) {
  return (
    <View className="gap-8">
      <SectionLabel step="Step 1" title="About You" desc="Let's get set up with basic details" />
      <View className="gap-6">
        <InputGroup 
          label="Birthday" 
          value={formData.date_of_birth} 
          onChange={(v: string) => updateForm('date_of_birth', v)} 
          placeholder="YYYY-MM-DD" 
        />
        <View>
          <Text className="text-slate-400 text-sm font-black uppercase tracking-widest mb-4 px-1">Gender</Text>
          <View className="flex-row gap-3">
            {['Male', 'Female', 'Other'].map(g => (
              <TouchableOpacity 
                key={g} 
                onPress={() => updateForm('gender', g)} 
                className={`flex-1 py-5 items-center rounded-[24px] border-2 ${
                  formData.gender === g ? 'bg-blue-600 border-blue-400' : 'bg-slate-900/50 border-slate-900'
                }`}
              >
                <Text className={`font-black ${formData.gender === g ? 'text-white' : 'text-slate-500'}`}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <InputGroup 
          label="Height (CM)" 
          value={formData.height_cm} 
          onChange={(v: string) => updateForm('height_cm', v)} 
          placeholder="e.g. 180" 
          keyboardType="numeric" 
        />
      </View>
    </View>
  );
}
