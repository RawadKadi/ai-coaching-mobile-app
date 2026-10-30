import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { Check, Palette, Type, X, Sliders, ChevronDown } from 'lucide-react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { AVAILABLE_FONTS, getFontFamily } from '@/hooks/useAppFonts';
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
    name: 'Default Midnight',
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
    id: 'calm_green',
    name: 'Emerald Health',
    primary_color: '#10B981',
    secondary_color: '#059669',
    accent_color: '#34D399',
    background_color: '#061713',
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

const POPULAR_PRIMARY_COLORS = [
  '#7FA7FF',
  '#2563EB',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EA580C',
  '#8B5CF6',
  '#EC4899',
  '#E11D48',
  '#FFFFFF',
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

  // Modals state
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<'primary' | 'background' | null>(null);
  const [modalColor, setModalColor] = useState('#7FA7FF');
  const [previousColor, setPreviousColor] = useState('#7FA7FF');

  const headingFont = getFontFamily(currentFont, '800');
  const bodyFont = getFontFamily(currentFont, '500');

  // Find matching preset name if any
  const matchedPreset = ONBOARDING_THEME_PRESETS.find(
    (p) =>
      p.primary_color.toLowerCase() === currentPrimary.toLowerCase() &&
      p.background_color.toLowerCase() === currentBackground.toLowerCase()
  );

  const applyPreset = (preset: ThemePreset) => {
    updateForm('primary_color', preset.primary_color);
    updateForm('secondary_color', preset.secondary_color);
    updateForm('accent_color', preset.accent_color);
    updateForm('background_color', preset.background_color);
    setShowPresetsModal(false);
  };

  const openPicker = (target: 'primary' | 'background', color: string) => {
    setColorPickerTarget(target);
    setModalColor(color);
    setPreviousColor(color);
  };

  const closePicker = () => {
    // Revert if cancelled
    if (colorPickerTarget === 'primary') {
      updateForm('primary_color', previousColor);
    } else if (colorPickerTarget === 'background') {
      updateForm('background_color', previousColor);
    }
    setColorPickerTarget(null);
  };

  const savePickerColor = () => {
    if (colorPickerTarget === 'primary') {
      updateForm('primary_color', modalColor);
    } else if (colorPickerTarget === 'background') {
      updateForm('background_color', modalColor);
    }
    setColorPickerTarget(null);
  };

  const handleColorLiveChange = (hex: string) => {
    setModalColor(hex);
    if (colorPickerTarget === 'background') {
      updateForm('background_color', hex);
    } else if (colorPickerTarget === 'primary') {
      updateForm('primary_color', hex);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <SectionLabel
        step="Step 3"
        title="Customize App"
        desc="Pick your colors and font. See changes live on this page."
        accentColor={currentPrimary}
        headingFont={headingFont}
        bodyFont={bodyFont}
      />

      {/* 1. Theme Preset Selector */}
      <View style={{ gap: 8 }}>
        <Text style={[styles.sectionTitle, { color: '#94A3B8', fontFamily: headingFont }]}>
          Theme
        </Text>
        <TouchableOpacity
          onPress={() => setShowPresetsModal(true)}
          activeOpacity={0.7}
          style={[styles.dropdownTrigger, { borderColor: '#1E293B' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.colorDot, { backgroundColor: currentPrimary }]} />
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: currentBackground, borderWidth: 1, borderColor: '#334155' },
                ]}
              />
            </View>
            <View>
              <Text style={[styles.triggerTitle, { fontFamily: headingFont }]}>
                {matchedPreset ? matchedPreset.name : 'Custom Theme'}
              </Text>
              <Text style={[styles.triggerSub, { fontFamily: bodyFont }]}>Tap to choose a theme</Text>
            </View>
          </View>
          <ChevronDown size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* 2. Main Button Color */}
      <View style={{ gap: 10 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: '#94A3B8', fontFamily: headingFont }]}>
            Button Color
          </Text>
          <TouchableOpacity
            onPress={() => openPicker('primary', currentPrimary)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Sliders size={13} color={currentPrimary} />
            <Text style={{ color: currentPrimary, fontSize: 13, fontWeight: '700', fontFamily: headingFont }}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected preview bar */}
        <TouchableOpacity
          onPress={() => openPicker('primary', currentPrimary)}
          activeOpacity={0.7}
          style={styles.colorBarCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.swatchLarge, { backgroundColor: currentPrimary }]} />
            <Text style={[styles.hexText, { fontFamily: headingFont }]}>{currentPrimary.toUpperCase()}</Text>
          </View>
          <Text style={[styles.editText, { color: currentPrimary, fontFamily: bodyFont }]}>Change</Text>
        </TouchableOpacity>

        {/* Popular button color swatches */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          {POPULAR_PRIMARY_COLORS.map((hex) => {
            const isSelected = currentPrimary.toLowerCase() === hex.toLowerCase();
            return (
              <TouchableOpacity
                key={hex}
                onPress={() => updateForm('primary_color', hex)}
                activeOpacity={0.8}
                style={[
                  styles.paletteCircle,
                  {
                    backgroundColor: hex,
                    borderColor: isSelected ? '#FFFFFF' : 'transparent',
                    borderWidth: isSelected ? 3 : 0,
                  },
                ]}
              >
                {isSelected && (
                  <Check size={16} color={hex.toLowerCase() === '#ffffff' ? '#000000' : '#FFFFFF'} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Background Color */}
      <View style={{ gap: 10 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: '#94A3B8', fontFamily: headingFont }]}>
            Background Color
          </Text>
          <TouchableOpacity
            onPress={() => openPicker('background', currentBackground)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Sliders size={13} color={currentPrimary} />
            <Text style={{ color: currentPrimary, fontSize: 13, fontWeight: '700', fontFamily: headingFont }}>
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => openPicker('background', currentBackground)}
          activeOpacity={0.7}
          style={styles.colorBarCard}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={[
                styles.swatchLarge,
                { backgroundColor: currentBackground, borderWidth: 1, borderColor: '#334155' },
              ]}
            />
            <Text style={[styles.hexText, { fontFamily: headingFont }]}>{currentBackground.toUpperCase()}</Text>
          </View>
          <Text style={[styles.editText, { color: currentPrimary, fontFamily: bodyFont }]}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* 4. App Font Dropdown */}
      <View style={{ gap: 8 }}>
        <Text style={[styles.sectionTitle, { color: '#94A3B8', fontFamily: headingFont }]}>
          App Font
        </Text>
        <TouchableOpacity
          onPress={() => setShowFontModal(true)}
          activeOpacity={0.7}
          style={[styles.dropdownTrigger, { borderColor: '#1E293B' }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: currentPrimary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Type size={18} color={currentPrimary} />
            </View>
            <View>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                  fontFamily: getFontFamily(currentFont, '700'),
                }}
              >
                {currentFont}
              </Text>
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 12,
                  fontFamily: getFontFamily(currentFont, '400'),
                  marginTop: 2,
                }}
              >
                Sample text in {currentFont}
              </Text>
            </View>
          </View>
          <ChevronDown size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* PRESETS MODAL */}
      <Modal
        visible={showPresetsModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPresetsModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Palette size={20} color={currentPrimary} />
                <Text style={[modalStyles.title, { fontFamily: headingFont }]}>Choose Theme</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPresetsModal(false)} style={modalStyles.closeButton}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {ONBOARDING_THEME_PRESETS.map((preset) => {
                  const active =
                    currentPrimary.toLowerCase() === preset.primary_color.toLowerCase() &&
                    currentBackground.toLowerCase() === preset.background_color.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => applyPreset(preset)}
                      activeOpacity={0.7}
                      style={[
                        modalStyles.itemRow,
                        {
                          backgroundColor: active ? currentPrimary + '15' : '#0F172A',
                          borderColor: active ? currentPrimary : '#1E293B',
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={[
                              styles.colorDotLarge,
                              { backgroundColor: preset.primary_color },
                            ]}
                          />
                          <View
                            style={[
                              styles.colorDotLarge,
                              {
                                backgroundColor: preset.background_color,
                                borderWidth: 1,
                                borderColor: '#334155',
                              },
                            ]}
                          />
                        </View>
                        <Text style={[modalStyles.itemText, { color: active ? '#FFFFFF' : '#CBD5E1' }]}>
                          {preset.name}
                        </Text>
                      </View>

                      {active && (
                        <View
                          style={[
                            modalStyles.checkBadge,
                            { backgroundColor: currentPrimary },
                          ]}
                        >
                          <Check size={14} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FONT MODAL */}
      <Modal
        visible={showFontModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFontModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Type size={20} color={currentPrimary} />
                <Text style={[modalStyles.title, { fontFamily: headingFont }]}>Choose Font</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFontModal(false)} style={modalStyles.closeButton}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {AVAILABLE_FONTS.map((font) => {
                  const active = currentFont === font.name;
                  const isSystem = font.name === 'System';
                  const itemHeadingFont = getFontFamily(font.name, '700');
                  const itemSampleFont = getFontFamily(
                    font.name,
                    font.name === 'Raleway' || font.name === 'Outfit' || font.name === 'Montserrat'
                      ? '500'
                      : '400'
                  );
                  return (
                    <TouchableOpacity
                      key={font.name}
                      onPress={() => {
                        updateForm('font_family', font.name);
                        setShowFontModal(false);
                      }}
                      activeOpacity={0.7}
                      style={[
                        modalStyles.itemRow,
                        {
                          backgroundColor: active ? currentPrimary + '15' : '#0F172A',
                          borderColor: active ? currentPrimary : '#1E293B',
                        },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          preserveFont={true}
                          style={{
                            fontFamily: itemHeadingFont,
                            fontSize: 16,
                            color: active ? currentPrimary : '#FFFFFF',
                            fontWeight: isSystem ? '700' : undefined,
                          }}
                        >
                          {font.name}
                        </Text>
                        <Text
                          preserveFont={true}
                          style={{
                            fontFamily: itemSampleFont,
                            fontSize: 12,
                            color: active ? '#CBD5E1' : '#64748B',
                            fontWeight: isSystem ? '400' : undefined,
                          }}
                        >
                          Smart training • Strong results
                        </Text>
                      </View>

                      {active && (
                        <View
                          style={[
                            modalStyles.checkBadge,
                            { backgroundColor: currentPrimary },
                          ]}
                        >
                          <Check size={14} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COLOR PICKER MODAL (WHEEL + SLIDER FIXED) */}
      <Modal
        visible={!!colorPickerTarget}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={modalStyles.header}>
              <Text style={[modalStyles.title, { fontFamily: headingFont }]}>
                {colorPickerTarget === 'primary' ? 'Pick Button Color' : 'Pick Background Color'}
              </Text>
              <TouchableOpacity onPress={closePicker} style={modalStyles.closeButton}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Height 285 gives ample room so the wheel canvas doesn't overlap the slider */}
            <View style={styles.colorWheelContainer}>
              <ColorPicker
                color={modalColor}
                onColorChange={(c: string) => setModalColor(c)}
                onColorChangeComplete={handleColorLiveChange}
                thumbSize={26}
                sliderSize={26}
                noSnap={true}
                row={false}
              />
            </View>

            <View style={styles.colorPreviewRow}>
              <View style={[styles.swatchMedium, { backgroundColor: modalColor }]} />
              <Text style={[styles.hexTextLarge, { fontFamily: headingFont }]}>
                {modalColor.toUpperCase()}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity
                onPress={closePicker}
                style={[styles.modalBtn, { backgroundColor: '#1E293B', flex: 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: '#94A3B8', fontFamily: headingFont }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePickerColor}
                style={[styles.modalBtn, { backgroundColor: currentPrimary, flex: 1.5 }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF', fontFamily: headingFont }]}>
                  Save Color
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  triggerSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorDotLarge: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  colorBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  swatchLarge: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  swatchMedium: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hexText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  hexTextLarge: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paletteCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorWheelContainer: {
    height: 285,
    width: '100%',
    marginBottom: 20,
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#020617',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalBtn: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemText: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
