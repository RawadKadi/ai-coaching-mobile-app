import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ruler, Scale, User, CalendarDays } from 'lucide-react-native';

interface Step1Props {
  formData: any;
  updateForm: (key: string, value: any) => void;
}

export default function Step1({ formData, updateForm }: Step1Props) {
  const colors = useBrandColors();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      updateForm('date_of_birth', formattedDate);
    }
  };

  const initialDate = formData.date_of_birth ? new Date(formData.date_of_birth) : new Date(2000, 0, 1);

  return (
    <View style={{ gap: 24 }}>
      {/* Date of Birth */}
      <View>
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          Date of Birth
        </Text>
        <TouchableOpacity 
          onPress={() => setShowDatePicker(true)}
          style={{
            backgroundColor: '#0F172A',
            borderWidth: 1,
            borderColor: '#1E293B',
            borderRadius: 24,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
          }}
        >
          <View style={{ width: 40, height: 40, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
            <CalendarDays size={20} color={colors.primary} />
          </View>
          <Text style={{ color: formData.date_of_birth ? '#FFFFFF' : '#475569', fontSize: 18, fontWeight: '800' }}>
            {formData.date_of_birth || 'Select your birthday'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={{ marginTop: 12, backgroundColor: '#0F172A', borderRadius: 24, padding: 12, borderWidth: 1, borderColor: '#1E293B' }}>
            {Platform.OS === 'ios' && (
              <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            <DateTimePicker
              value={initialDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
              textColor="#FFFFFF"
              themeVariant="dark"
            />
          </View>
        )}
      </View>

      {/* Gender */}
      <View>
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
          Gender Identity
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {['Male', 'Female', 'Other'].map((g) => {
            const isSelected = formData.gender === g;
            return (
              <TouchableOpacity
                key={g}
                onPress={() => updateForm('gender', g)}
                style={{
                  flex: 1,
                  height: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? colors.primary : '#0F172A',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: isSelected ? '#60A5FA' : '#1E293B',
                  shadowColor: isSelected ? colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isSelected ? 0.3 : 0,
                  shadowRadius: 12,
                  elevation: isSelected ? 5 : 0
                }}
              >
                <Text style={{ color: isSelected ? '#FFFFFF' : '#94A3B8', fontWeight: '900', fontSize: 15 }}>
                  {g}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Height and Weight Row */}
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* Height */}
        <View style={{ flex: 1, height: 150, backgroundColor: 'rgba(15,23,42,0.4)', borderRadius: 32, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
              <Ruler size={18} color={colors.primary} />
            </View>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>Height</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48 }}>
            <TextInput
              style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', flex: 1, minHeight: 48 }}
              placeholder="0"
              placeholderTextColor="#334155"
              value={formData.height_cm}
              onChangeText={(text) => updateForm('height_cm', text)}
              keyboardType="numeric"
            />
            <Text style={{ color: '#64748B', fontSize: 16, fontWeight: '800', marginBottom: 6 }}>CM</Text>
          </View>
        </View>

        {/* Weight */}
        <View style={{ flex: 1, height: 150, backgroundColor: 'rgba(15,23,42,0.4)', borderRadius: 32, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
              <Scale size={18} color="#10B981" />
            </View>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>Weight</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48 }}>
            <TextInput
              style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', flex: 1, minHeight: 48 }}
              placeholder="0.0"
              placeholderTextColor="#334155"
              value={formData.starting_weight_kg}
              onChangeText={(text) => updateForm('starting_weight_kg', text)}
              keyboardType="numeric"
            />
            <Text style={{ color: '#64748B', fontSize: 16, fontWeight: '800', marginBottom: 6 }}>KG</Text>
          </View>
        </View>
      </View>

    </View>
  );
}
