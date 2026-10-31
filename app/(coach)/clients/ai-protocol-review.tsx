import { useTheme } from '@/contexts/BrandContext';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Check, Plus, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { SuggestedHabit } from '@/lib/ai-protocol-service';

export default function AIProtocolReviewScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const buttonTheme = theme.button;
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { clientId, clientName, suggestions } = useLocalSearchParams();
  const { coach } = useAuth();
  
  const parsedSuggestions: SuggestedHabit[] = suggestions ? JSON.parse(suggestions as string) : [];
  
  const [selectedIds, setSelectedIds] = useState<number[]>(parsedSuggestions.map((_, i) => i));
  const [saving, setSaving] = useState(false);

  const toggleSelection = (index: number) => {
    if (selectedIds.includes(index)) {
      setSelectedIds(selectedIds.filter(id => id !== index));
    } else {
      setSelectedIds([...selectedIds, index]);
    }
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one task to add.');
      return;
    }

    try {
      setSaving(true);
      
      const habitsToAdd = parsedSuggestions
        .filter((_, index) => selectedIds.includes(index))
        .map(h => ({
          client_id: clientId,
          name: h.name,
          description: h.description,
          category: h.category,
          verification_type: h.verification_type,
          is_active: true,
          target_value: 1,
          unit: 'completion',
          frequency: 'daily'
        }));

      const { error } = await supabase.from('habits').insert(habitsToAdd);
      
      if (error) throw error;

      Alert.alert(
        'Success', 
        'The selected tasks have been added.',
        [{ text: 'OK', onPress: () => router.push(`/(coach)/clients/${clientId}`) }]
      );
    } catch (error: any) {
      Alert.alert('Save Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ padding: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 16 }}
            >
              <ArrowLeft size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Review Tasks</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>For {clientName}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <MotiView 
            from={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
              backgroundColor: `${colors.primary}0d`, 
              borderRadius: 32, 
              padding: 24, 
              borderWidth: 1, 
              borderColor: `${colors.primary}25`,
              marginBottom: 32,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={24} color={colors.textOnPrimary || 'white'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>Suggestions Ready</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Review and select the tasks you want to assign.</Text>
            </View>
          </MotiView>

          <View style={{ gap: 16 }}>
            {parsedSuggestions.map((habit, index) => {
              const isSelected = selectedIds.includes(index);
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => toggleSelection(index)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isSelected ? `${colors.primary}0d` : colors.surface,
                    borderRadius: 28,
                    padding: 24,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>{habit.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <View style={{ backgroundColor: colors.background, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>{habit.category}</Text>
                        </View>
                        <View style={{ backgroundColor: colors.background, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {habit.verification_type === 'none' ? 'checkbox' : (habit.verification_type === 'camera' ? 'photo' : habit.verification_type)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      borderWidth: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      borderColor: isSelected ? colors.primary : colors.border
                    }}>
                      {isSelected && <Check size={16} color={colors.textOnPrimary || 'white'} />}
                    </View>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{habit.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity 
            onPress={handleSave}
            disabled={saving || selectedIds.length === 0}
            style={{
              height: 60,
              borderRadius: buttonTheme?.borderRadius ? Math.max(buttonTheme.borderRadius, 20) : 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selectedIds.length === 0 ? colors.surface : colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 4,
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textOnPrimary || 'white'} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Plus size={20} color={colors.textOnPrimary || 'white'} style={{ marginRight: 10 }} />
                <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase' }}>
                  Add {selectedIds.length} Tasks
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
