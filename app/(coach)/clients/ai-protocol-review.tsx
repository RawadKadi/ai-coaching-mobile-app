import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Check, Plus, Target, Info, Zap } from 'lucide-react-native';
import { MotiView } from 'moti';
import { SuggestedHabit } from '@/lib/ai-protocol-service';

export default function AIProtocolReviewScreen() {
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
      Alert.alert('Selection Required', 'Please select at least one habit to add.');
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
        'The selected habits have been added to the daily protocol.',
        [{ text: 'Great', onPress: () => router.push(`/(coach)/clients/${clientId}`) }]
      );
    } catch (error: any) {
      Alert.alert('Save Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ padding: 10, backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginRight: 16 }}
            >
              <ArrowLeft size={18} color="#94A3B8" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Review Protocol</Text>
              <Text style={{ color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>For {clientName}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.05)', 
              borderRadius: 32, 
              padding: 24, 
              borderWidth: 1, 
              borderColor: 'rgba(16, 185, 129, 0.1)',
              marginBottom: 32,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={24} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Suggestions Ready</Text>
              <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>Review and select the habits you want to assign.</Text>
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
                    backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : '#0F172A',
                    borderRadius: 28,
                    padding: 24,
                    borderWidth: 2,
                    borderColor: isSelected ? '#3B82F6' : '#1E293B',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: 'white', fontSize: 18, fontWeight: 'black' }}>{habit.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <View style={{ backgroundColor: '#1E293B', px: 3, py: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>{habit.category}</Text>
                        </View>
                        <View style={{ backgroundColor: '#1E293B', px: 3, py: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>
                            {habit.verification_type === 'none' ? 'checkbox' : habit.verification_type}
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
                      backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                      borderColor: isSelected ? '#3B82F6' : '#1E293B'
                    }}>
                      {isSelected && <Check size={16} color="white" />}
                    </View>
                  </View>
                  <Text style={{ color: '#94A3B8', fontSize: 14, lineHeight: 20 }}>{habit.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#0F172A' }}>
          <TouchableOpacity 
            onPress={handleSave}
            disabled={saving || selectedIds.length === 0}
            style={{
              height: 60,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selectedIds.length === 0 ? '#1E293B' : '#2563EB',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Plus size={20} color="white" style={{ marginRight: 10 }} />
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' }}>
                  Add {selectedIds.length} Habits
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
