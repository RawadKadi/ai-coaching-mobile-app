import React from 'react';
import { View } from 'react-native';
import SectionLabel from '../SectionLabel';
import CardOption from './CardOption';

interface Step4Props {
  formData: {
    dietary_restrictions: string[];
  };
  updateForm: (key: string, value: any) => void;
}

export default function Step4({ formData, updateForm }: Step4Props) {
  return (
    <View className="gap-8">
      <SectionLabel step="Step 4" title="Dietary Preferences" desc="Any dietary preferences?" />
      <View className="gap-4">
        {[
          { key: 'Standard', label: 'No Restrictions', desc: 'Eat everything' },
          { key: 'Vegetarian', label: 'Vegetarian', desc: 'No meat or fish' },
          { key: 'Vegan', label: 'Vegan', desc: 'Plant-based only' },
          { key: 'Ketogenic', label: 'Keto', desc: 'Low carb, high fat' }
        ].map(item => {
          const active = formData.dietary_restrictions.includes(item.key);
          return (
            <CardOption 
              key={item.key} 
              label={item.label} 
              desc={item.desc} 
              selected={active} 
              onSelect={() => {
                const cur = formData.dietary_restrictions;
                updateForm('dietary_restrictions', active ? cur.filter(i => i !== item.key) : [...cur, item.key]);
              }} 
              activeColor="#3B82F6" 
            />
          );
        })}
      </View>
    </View>
  );
}
