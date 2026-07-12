import { useBrandColors } from '@/contexts/BrandContext';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Step2Props {
  formData: any;
  updateForm: (key: string, value: any) => void;
}

const GOALS = [
  'Lose Fat',
  'Build Muscle',
  'Improve Endurance',
  'Get Stronger',
  'Better Health',
  'Sports Performance'
];

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function Step2({ formData, updateForm }: Step2Props) {
  const colors = useBrandColors();
  // Goals is stored as a single string currently in DB `goal text`
  // We can let them pick up to 2 and join them, or update the DB to array.
  // The user requested: "Goal selection (Max 2)"
  const currentGoals = formData.goal ? formData.goal.split(', ') : [];

  const toggleGoal = (goal: string) => {
    let nextGoals = [...currentGoals];
    if (nextGoals.includes(goal)) {
      nextGoals = nextGoals.filter(g => g !== goal);
    } else {
      if (nextGoals.length < 2) {
        nextGoals.push(goal);
      }
    }
    updateForm('goal', nextGoals.join(', '));
  };

  return (
    <View style={{ gap: 32 }}>
      {/* Goals */}
      <View>
        <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Your Target (Pick up to 2)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {GOALS.map((g) => {
            const isSelected = currentGoals.includes(g);
            const isDisabled = !isSelected && currentGoals.length >= 2;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => toggleGoal(g)}
                disabled={isDisabled}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  backgroundColor: isSelected ? '#2563EB' : '#0F172A',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : '#1E293B',
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                <Text style={{ color: isSelected ? '#FFFFFF' : '#94A3B8', fontWeight: '600' }}>
                  {g}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Experience Level */}
      <View>
        <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Experience Level
        </Text>
        <View style={{ gap: 12 }}>
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = formData.experience_level === level;
            return (
              <TouchableOpacity
                key={level}
                onPress={() => updateForm('experience_level', level)}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  backgroundColor: isSelected ? 'rgba(59,130,246,0.1)' : '#0F172A',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : '#1E293B',
                }}
              >
                <Text style={{ color: isSelected ? '#FFFFFF' : '#94A3B8', fontWeight: '600', fontSize: 16 }}>
                  {level}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
