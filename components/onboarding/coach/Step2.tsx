import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Check } from 'lucide-react-native';
import SectionLabel from '../SectionLabel';

const SPECIALTIES = [
  'Body Composition (Fat Loss/Muscle)',
  'Strength & Powerlifting',
  'Athletic Performance & Sports',
  'Functional Fitness & Cross-Training',
  'Calisthenics & Bodyweight',
  'Cardio & Endurance (Running/Cycling)',
  'Injury Rehab & Physiotherapy',
  'Mobility, Yoga & Pilates',
  'Martial Arts & Combat Sports',
  'General Health & Wellness Coaching',
  'Nutrition & Dietetics',
  'Longevity & Anti-Aging',
  'Mindset & Mental Performance',
  'Holistic & Alternative Health',
  'Other',
];

const MAX = 3;

interface Step2Props {
  formData: {
    specialty: string[];
    otherSpecialty?: string;
  };
  toggleSpecialty: (spec: string) => void;
  updateForm: (key: string, value: any) => void;
}

export default function Step2({ formData, toggleSpecialty, updateForm }: Step2Props) {
  const selected = formData.specialty ?? [];
  const atMax = selected.length >= MAX;
  const otherSelected = selected.includes('Other');

  // Animate height of the "Other" text input
  const otherInputAnim = useRef(new Animated.Value(otherSelected ? 1 : 0)).current;

  const handleToggle = (spec: string) => {
    if (spec === 'Other') {
      const wasOn = selected.includes('Other');
      toggleSpecialty('Other');
      Animated.timing(otherInputAnim, {
        toValue: wasOn ? 0 : 1,
        duration: 260,
        useNativeDriver: false,
      }).start();
      if (wasOn) updateForm('otherSpecialty', '');
    } else {
      if (atMax && !selected.includes(spec)) return;
      toggleSpecialty(spec);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <SectionLabel
        step="Step 2"
        title="Your Specialties"
        desc="Pick up to 3 areas you coach. This shapes how AI generates tasks and challenges for your clients."
      />

      {/* Counter row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text style={{ color: atMax ? '#F59E0B' : '#64748B', fontSize: 13, fontWeight: '600' }}>
          {atMax ? 'Deselect to swap' : 'Select your focus areas'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {[1, 2, 3].map((dot) => (
            <View
              key={dot}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: dot <= selected.length ? '#3B82F6' : '#1E293B',
              }}
            />
          ))}
          <Text style={{ color: atMax ? '#3B82F6' : '#64748B', fontSize: 13, fontWeight: '800', marginLeft: 4 }}>
            {selected.length}/{MAX}
          </Text>
        </View>
      </View>

      {/* Specialty list */}
      <View style={{ gap: 10 }}>
        {SPECIALTIES.map((spec) => {
          const isOther = spec === 'Other';
          const isSelected = selected.includes(spec);
          const isDisabled = atMax && !isSelected;

          return (
            <View key={spec}>
              <TouchableOpacity
                onPress={() => handleToggle(spec)}
                activeOpacity={isDisabled ? 1 : 0.7}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 20,
                  borderWidth: 2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isSelected
                    ? 'rgba(37,99,235,0.12)'
                    : isDisabled
                    ? 'rgba(15,23,42,0.3)'
                    : 'rgba(15,23,42,0.6)',
                  borderColor: isSelected
                    ? '#3B82F6'
                    : isDisabled
                    ? '#0A0F1E'
                    : '#1E293B',
                }}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    fontSize: 15,
                    flex: 1,
                    paddingRight: 12,
                    color: isSelected ? '#FFFFFF' : isDisabled ? '#2D3F55' : '#94A3B8',
                  }}
                >
                  {spec}
                </Text>
                {isSelected && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={13} color="white" />
                  </View>
                )}
              </TouchableOpacity>

              {/* "Other" custom text input — slides in when selected */}
              {isOther && (
                <Animated.View
                  style={{
                    overflow: 'hidden',
                    maxHeight: otherInputAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }),
                    opacity: otherInputAnim,
                    marginTop: otherInputAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
                  }}
                >
                  <TextInput
                    value={formData.otherSpecialty || ''}
                    onChangeText={(text) => updateForm('otherSpecialty', text)}
                    placeholder="Describe your specialty..."
                    placeholderTextColor="#334155"
                    autoCapitalize="words"
                    returnKeyType="done"
                    style={{
                      backgroundColor: '#0A1628',
                      borderWidth: 1.5,
                      borderColor: '#2563EB',
                      borderRadius: 16,
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  />
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
