import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Check, Palette, Sparkles, Type } from 'lucide-react-native';
import SectionLabel from '../SectionLabel';

export interface ThemePreset {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
}

export const ONBOARDING_THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default_dark',
    name: 'Default Dark',
    primary_color: '#7FA7FF',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    background_color: '#010417',
  },
  {
    id: 'modern_blue',
    name: 'Cobalt Blue',
    primary_color: '#2563EB',
    secondary_color: '#60A5FA',
    accent_color: '#38BDF8',
    background_color: '#071226',
  },
  {
    id: 'energetic_orange',
    name: 'Fire Orange',
    primary_color: '#EA580C',
    secondary_color: '#F97316',
    accent_color: '#F59E0B',
    background_color: '#160C08',
  },
  {
    id: 'calm_green',
    name: 'Emerald Health',
    primary_color: '#10B981',
    secondary_color: '#059669',
    accent_color: '#34D399',
    background_color: '#061713',
  },
  {
    id: 'royal_purple',
    name: 'Royal Purple',
    primary_color: '#8B5CF6',
    secondary_color: '#A78BFA',
    accent_color: '#C084FC',
    background_color: '#120924',
  },
  {
    id: 'crimson_red',
    name: 'Crimson Power',
    primary_color: '#E11D48',
    secondary_color: '#F43F5E',
    accent_color: '#FB7185',
    background_color: '#1C080E',
  },
];

const POPULAR_COLORS = [
  '#7FA7FF',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EA580C',
  '#8B5CF6',
  '#EC4899',
  '#E11D48',
];

const FONTS = [
  { id: 'System', label: 'System Default' },
  { id: 'Outfit', label: 'Outfit (Modern)' },
  { id: 'Inter', label: 'Inter (Clean)' },
  { id: 'Roboto', label: 'Roboto (Athletic)' },
];

interface CustomizeAppStepProps {
  formData: {
    business_name: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    background_color?: string;
    font_family?: string;
  };
  updateForm: (key: string, value: any) => void;
}

export default function CustomizeAppStep({ formData, updateForm }: CustomizeAppStepProps) {
  const currentPrimary = formData.primary_color || '#7FA7FF';
  const currentBackground = formData.background_color || '#010417';
  const currentFont = formData.font_family || 'System';

  const applyPreset = (preset: ThemePreset) => {
    updateForm('primary_color', preset.primary_color);
    updateForm('secondary_color', preset.secondary_color);
    updateForm('accent_color', preset.accent_color);
    updateForm('background_color', preset.background_color);
  };

  const isPresetActive = (preset: ThemePreset) => {
    return (
      currentPrimary.toLowerCase() === preset.primary_color.toLowerCase() &&
      currentBackground.toLowerCase() === preset.background_color.toLowerCase()
    );
  };

  return (
    <View style={{ gap: 28 }}>
      <SectionLabel
        step="Step 3"
        title="Customize Your App"
        desc="Choose your theme colors and style. All your clients will inherit this custom look."
      />

      {/* Live Mini Preview */}
      <View
        style={{
          backgroundColor: currentBackground,
          borderRadius: 24,
          padding: 20,
          borderWidth: 1.5,
          borderColor: '#1E293B',
          gap: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: currentPrimary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>
                {(formData.business_name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
              {formData.business_name || 'Your Brand'}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: currentPrimary + '20',
              borderWidth: 1,
              borderColor: currentPrimary + '40',
            }}
          >
            <Text style={{ color: currentPrimary, fontSize: 11, fontWeight: '800' }}>Client View</Text>
          </View>
        </View>

        {/* Mock card */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700' }}>TODAY'S WORKOUT</Text>
            <Sparkles size={14} color={currentPrimary} />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
            Upper Body Hypertrophy
          </Text>
          <View
            style={{
              height: 38,
              borderRadius: 12,
              backgroundColor: currentPrimary,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Start Session</Text>
          </View>
        </View>
      </View>

      {/* Preset Themes */}
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Palette size={16} color={currentPrimary} />
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 }}>
            Theme Presets
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {ONBOARDING_THEME_PRESETS.map((preset) => {
            const active = isPresetActive(preset);
            return (
              <TouchableOpacity
                key={preset.id}
                onPress={() => applyPreset(preset)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 18,
                  backgroundColor: active ? 'rgba(37,99,235,0.12)' : '#0F172A',
                  borderWidth: 2,
                  borderColor: active ? currentPrimary : '#1E293B',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* Color dots preview */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.primary_color }} />
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.secondary_color }} />
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.background_color, borderWidth: 1, borderColor: '#334155' }} />
                  </View>
                  <Text style={{ color: active ? '#FFFFFF' : '#CBD5E1', fontSize: 15, fontWeight: '700' }}>
                    {preset.name}
                  </Text>
                </View>

                {active && (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: currentPrimary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Primary Brand Color Swatches */}
      <View style={{ gap: 12 }}>
        <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, paddingHorizontal: 4 }}>
          Primary Brand Accent
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {POPULAR_COLORS.map((hex) => {
            const isSelected = currentPrimary.toLowerCase() === hex.toLowerCase();
            return (
              <TouchableOpacity
                key={hex}
                onPress={() => updateForm('primary_color', hex)}
                activeOpacity={0.8}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: hex,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: isSelected ? '#FFFFFF' : 'transparent',
                  shadowColor: isSelected ? hex : 'transparent',
                  shadowOpacity: 0.5,
                  shadowRadius: 6,
                }}
              >
                {isSelected && <Check size={18} color="#FFFFFF" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Font Family Selection */}
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Type size={16} color={currentPrimary} />
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 }}>
            App Typography
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          {FONTS.map((f) => {
            const active = currentFont === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => updateForm('font_family', f.id)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 16,
                  backgroundColor: active ? 'rgba(37,99,235,0.12)' : '#0F172A',
                  borderWidth: 1.5,
                  borderColor: active ? currentPrimary : '#1E293B',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: active ? '#FFFFFF' : '#CBD5E1', fontSize: 15, fontWeight: '700' }}>
                  {f.label}
                </Text>
                {active && (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: currentPrimary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={13} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
