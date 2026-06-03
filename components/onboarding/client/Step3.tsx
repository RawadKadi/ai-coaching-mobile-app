import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';

interface Step3Props {
  formData: any;
  updateForm: (key: string, value: any) => void;
}

const DIETS = ['None', 'Vegan', 'Vegetarian', 'Keto', 'Paleo', 'Gluten-Free', 'Dairy-Free'];
const MEDICAL = ['None', 'Bad Knees', 'Lower Back Pain', 'Shoulder Issues', 'Asthma', 'Diabetes', 'Other +'];

export default function Step3({ formData, updateForm }: Step3Props) {
  const toggleItem = (field: string, item: string) => {
    let currentList = Array.isArray(formData[field]) ? [...formData[field]] : [];
    
    if (item === 'None') {
      currentList = ['None'];
    } else {
      currentList = currentList.filter(x => x !== 'None');
      if (currentList.includes(item)) {
        currentList = currentList.filter(x => x !== item);
      } else {
        currentList.push(item);
      }
    }
    updateForm(field, currentList);
  };

  const renderSection = (title: string, field: string, options: string[]) => {
    const currentList = Array.isArray(formData[field]) ? formData[field] : [];
    return (
      <View>
        <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {options.map((opt) => {
            const isSelected = currentList.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => toggleItem(field, opt)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  backgroundColor: isSelected ? '#2563EB' : '#0F172A',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: isSelected ? '#3B82F6' : '#1E293B',
                }}
              >
                <Text style={{ color: isSelected ? '#FFFFFF' : '#94A3B8', fontWeight: '600' }}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const medicalList = Array.isArray(formData.medical_conditions) ? formData.medical_conditions : [];
  const isOtherSelected = medicalList.includes('Other +');

  return (
    <View style={{ gap: 32 }}>
      {renderSection('Dietary Restrictions', 'dietary_restrictions', DIETS)}
      
      <View>
        {renderSection('Medical Limitations', 'medical_conditions', MEDICAL)}
        
        {isOtherSelected && (
          <View style={{ marginTop: 16 }}>
            <TextInput
              style={{
                backgroundColor: '#0F172A',
                borderWidth: 1,
                borderColor: '#3B82F6',
                borderRadius: 16,
                padding: 16,
                color: '#FFFFFF',
                fontSize: 16,
                minHeight: 100,
                textAlignVertical: 'top'
              }}
              placeholder="Describe any other medical conditions..."
              placeholderTextColor="#475569"
              multiline
              value={formData.medical_conditions_other || ''}
              onChangeText={(text) => updateForm('medical_conditions_other', text)}
            />
          </View>
        )}
      </View>
    </View>
  );
}
