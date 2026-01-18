import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  Switch,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Upload, Save, Eye, Palette } from 'lucide-react-native';
import { useBrand, useTheme, Brand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { BrandedButton } from '@/components/BrandedButton';
import { BrandedCard } from '@/components/BrandedCard';
import { BrandedText } from '@/components/BrandedText';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { generateDarkTheme } from '@/lib/theme-utils';
import ColorPicker from 'react-native-wheel-color-picker';

// Preset themes
const PRESET_THEMES = {
  modernBlue: {
    name: 'Modern Blue',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    background_color: '#F9FAFB',
    button_shape: 'rounded' as const,
    button_style: 'flat' as const,
  },
  professionalDark: {
    name: 'Professional Dark',
    primary_color: '#1E40AF',
    secondary_color: '#059669',
    accent_color: '#D97706',
    background_color: '#F3F4F6',
    button_shape: 'rounded' as const,
    button_style: 'flat' as const,
    dark_mode_enabled: true as boolean | undefined,
  },
  energeticOrange: {
    name: 'Energetic Orange',
    primary_color: '#EA580C',
    secondary_color: '#0891B2',
    accent_color: '#84CC16',
    background_color: '#FFFBEB',
    button_shape: 'pill' as const,
    button_style: 'gradient' as const,
  },
  calmGreen: {
    name: 'Calm Green',
    primary_color: '#059669',
    secondary_color: '#0EA5E9',
    accent_color: '#F59E0B',
    background_color: '#F0FDF4',
    button_shape: 'rounded' as const,
    button_style: 'flat' as const,
  },
  premiumPurple: {
    name: 'Premium Purple',
    primary_color: '#7C3AED',
    secondary_color: '#EC4899',
    accent_color: '#F59E0B',
    background_color: '#FAF5FF',
    button_shape: 'pill' as const,
    button_style: 'gradient' as const,
  },
};

export default function BrandSettingsScreen() {
  const router = useRouter();
  const { brand, canManageBrand, updateBrandSettings, refreshBrand } = useBrand();
  const currentTheme = useTheme();
  const { coach } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'colors' | 'typography' | 'buttons' | 'spacing' | 'dark'>('identity');
  const [showPreview, setShowPreview] = useState(false);
  
  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeColorField, setActiveColorField] = useState<'primary' | 'secondary' | 'accent' | 'background' | 'darkPrimary' | 'darkSecondary' | 'darkAccent' | 'darkBackground'>('primary');
  
  // Form state - Basic Identity
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Form state - Colors
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [backgroundColor, setBackgroundColor] = useState('#F9FAFB');
  
  // Form state - Typography
  const [fontFamily, setFontFamily] = useState('System');
  const [headingWeight, setHeadingWeight] = useState('700');
  const [bodyWeight, setBodyWeight] = useState('400');
  const [fontScale, setFontScale] = useState(1.0);
  
  // Form state - Buttons
  const [buttonShape, setButtonShape] = useState<'rounded' | 'pill' | 'square'>('rounded');
  const [buttonStyle, setButtonStyle] = useState<'flat' | 'gradient' | 'outlined'>('flat');
  const [buttonShadow, setButtonShadow] = useState(false);
  
  // Form state - Spacing
  const [spacingScale, setSpacingScale] = useState(1.0);
  const [cardShadow, setCardShadow] = useState<'none' | 'small' | 'medium' | 'large'>('medium');
  const [borderRadiusScale, setBorderRadiusScale] = useState(1.0);
  
  // Form state - Dark Mode
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [darkPrimaryColor, setDarkPrimaryColor] = useState('');
  const [darkSecondaryColor, setDarkSecondaryColor] = useState('');
  const [darkAccentColor, setDarkAccentColor] = useState('');
  const [darkBackgroundColor, setDarkBackgroundColor] = useState('');

  // Load brand data
  useEffect(() => {
    if (brand) {
      setBrandName(brand.name);
      setLogoUrl(brand.logo_url || '');
      setPrimaryColor(brand.primary_color);
      setSecondaryColor(brand.secondary_color);
      setAccentColor(brand.accent_color);
      setBackgroundColor(brand.background_color);
      setFontFamily(brand.font_family);
      setHeadingWeight(brand.heading_font_weight);
      setBodyWeight(brand.body_font_weight);
      setFontScale(brand.font_scale);
      setButtonShape(brand.button_shape);
      setButtonStyle(brand.button_style);
      setButtonShadow(brand.button_shadow_enabled);
      setSpacingScale(brand.spacing_scale);
      setCardShadow(brand.card_shadow);
      setBorderRadiusScale(brand.border_radius_scale);
      setDarkModeEnabled(brand.dark_mode_enabled);
      setDarkPrimaryColor(brand.dark_primary_color || '');
      setDarkSecondaryColor(brand.dark_secondary_color || '');
      setDarkAccentColor(brand.dark_accent_color || '');
      setDarkBackgroundColor(brand.dark_background_color || '');
    }
  }, [brand]);

  // No permission view
  if (!canManageBrand) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Brand Settings</Text>
        </View>
        
        <View style={styles.noPermissionContainer}>
          <Text style={styles.noPermissionTitle}>No Permission</Text>
          <Text style={styles.noPermissionText}>
            Brand settings are managed by your parent coach.
          </Text>
          
          {brand && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Current Brand:</Text>
              {brand.logo_url && (
                <Image source={{ uri: brand.logo_url }} style={styles.logoPreview} />
              )}
              <Text style={styles.brandNamePreview}>{brand.name}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadLogo(result.assets[0].uri);
    }
  };

  const uploadLogo = async (uri: string) => {
    try {
      setUploading(true);
      
      // Extract file extension properly
      // For blob URIs from image picker, default to jpg
      let fileExt = 'jpg';
      if (uri.startsWith('file://') || uri.startsWith('content://')) {
        const uriParts = uri.split('.');
        if (uriParts.length > 1) {
          const ext = uriParts[uriParts.length - 1].split('?')[0]; // Remove query params
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext.toLowerCase())) {
            fileExt = ext.toLowerCase();
          }
        }
      }
      
      const fileName = `brand-logo-${Date.now()}.${fileExt}`;
      const filePath = `brands/${fileName}`;

      console.log('[Logo Upload] Starting upload:', { uri, fileName, filePath });

      // Fix: Use arrayBuffer instead of blob for React Native
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('[Logo Upload] Image fetched, size:', arrayBuffer.byteLength);

      // Map file extension to proper MIME type
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };

      const { error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(filePath, arrayBuffer, {
          contentType: mimeTypes[fileExt] || 'image/jpeg',
          upsert: true, // Allow overwriting
        });

      if (uploadError) {
        console.error('[Logo Upload] Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('meal-photos')
        .getPublicUrl(filePath);

      console.log('[Logo Upload] Upload successful:', publicUrl);
      setLogoUrl(publicUrl);
      Alert.alert('Success', 'Logo uploaded successfully!');
    } catch (error) {
      console.error('[Logo Upload] Error:', error);
      Alert.alert('Error', `Failed to upload logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const applyPreset = (presetKey: keyof typeof PRESET_THEMES) => {
    const preset = PRESET_THEMES[presetKey];
    setPrimaryColor(preset.primary_color);
    setSecondaryColor(preset.secondary_color);
    setAccentColor(preset.accent_color);
    setBackgroundColor(preset.background_color);
    setButtonShape(preset.button_shape);
    setButtonStyle(preset.button_style);
    if ('dark_mode_enabled' in preset && preset.dark_mode_enabled) {
      setDarkModeEnabled(true);
    }
    Alert.alert('Preset Applied', `${preset.name} theme has been applied. Don't forget to save!`);
  };

  const autoGenerateDarkTheme = () => {
    const darkTheme = generateDarkTheme({
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      background: backgroundColor,
    });
    
    setDarkPrimaryColor(darkTheme.primary);
    setDarkSecondaryColor(darkTheme.secondary);
    setDarkAccentColor(darkTheme.accent);
    setDarkBackgroundColor(darkTheme.background);
    setDarkModeEnabled(true);
    
    Alert.alert('Dark Theme Generated', 'Dark mode colors have been auto-generated from your light theme!');
  };

  const openColorPicker = (field: typeof activeColorField, currentColor: string) => {
    setActiveColorField(field);
    setShowColorPicker(true);
  };

  const handleColorChange = (color: string) => {
    switch (activeColorField) {
      case 'primary':
        setPrimaryColor(color);
        break;
      case 'secondary':
        setSecondaryColor(color);
        break;
      case 'accent':
        setAccentColor(color);
        break;
      case 'background':
        setBackgroundColor(color);
        break;
      case 'darkPrimary':
        setDarkPrimaryColor(color);
        break;
      case 'darkSecondary':
        setDarkSecondaryColor(color);
        break;
      case 'darkAccent':
        setDarkAccentColor(color);
        break;
      case 'darkBackground':
        setDarkBackgroundColor(color);
        break;
    }
  };

  const handleSave = async () => {
    if (!brandName.trim()) {
      Alert.alert('Error', 'Please enter a brand name');
      return;
    }

    setLoading(true);
    
    try {
      const success = await updateBrandSettings({
        name: brandName,
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        background_color: backgroundColor,
        font_family: fontFamily,
        heading_font_weight: headingWeight,
        body_font_weight: bodyWeight,
        font_scale: fontScale,
        button_shape: buttonShape,
        button_style: buttonStyle,
        button_shadow_enabled: buttonShadow,
        spacing_scale: spacingScale,
        card_shadow: cardShadow,
        border_radius_scale: borderRadiusScale,
        dark_mode_enabled: darkModeEnabled,
        dark_primary_color: darkPrimaryColor || null,
        dark_secondary_color: darkSecondaryColor || null,
        dark_accent_color: darkAccentColor || null,
        dark_background_color: darkBackgroundColor || null,
      });

      if (success) {
        Alert.alert('Success', 'Brand settings updated successfully!');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update brand settings');
      }
    } catch (error) {
      console.error('Error saving brand:', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'identity':
        return (
          <>
            <View style={[styles.section, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>Brand Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: currentTheme.colors.inputBackground, borderColor: currentTheme.colors.border, color: currentTheme.colors.text }]}
                placeholder="e.g., Elite Fitness Gym"
                value={brandName}
                onChangeText={setBrandName}
                placeholderTextColor={currentTheme.colors.textTertiary}
              />
            </View>

            <View style={[styles.section, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>Brand Logo</Text>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                onPress={pickImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#3B82F6" />
                ) : (
                  <>
                    <Upload size={20} color="#3B82F6" />
                    <Text style={styles.uploadButtonText}>
                      {logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              
              {logoUrl && (
                <View style={styles.logoPreviewContainer}>
                  <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
                </View>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>Quick Presets</Text>
              <Text style={[styles.helperText, { color: currentTheme.colors.textSecondary }]}>Apply a preset theme to get started quickly</Text>
              <View style={styles.presetGrid}>
                {Object.entries(PRESET_THEMES).map(([key, preset]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.presetCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                    onPress={() => applyPreset(key as keyof typeof PRESET_THEMES)}
                  >
                    <View style={styles.presetColors}>
                      <View style={[styles.presetColorDot, { backgroundColor: preset.primary_color }]} />
                      <View style={[styles.presetColorDot, { backgroundColor: preset.secondary_color }]} />
                    </View>
                    <Text style={[styles.presetName, { color: currentTheme.colors.text }]}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 'colors':
        return (
          <>
            <VisualColorPicker
              label="Primary Color"
              value={primaryColor}
              onPress={() => openColorPicker('primary', primaryColor)}
              helper="Main color for buttons and accents"
            />
            <VisualColorPicker
              label="Secondary Color"
              value={secondaryColor}
              onPress={() => openColorPicker('secondary', secondaryColor)}
              helper="Supporting color for secondary elements"
            />
            <VisualColorPicker
              label="Accent Color"
              value={accentColor}
              onPress={() => openColorPicker('accent', accentColor)}
              helper="Used for highlights, badges, and links"
            />
            <VisualColorPicker
              label="Background Color"
              value={backgroundColor}
              onPress={() => openColorPicker('background', backgroundColor)}
              helper="App background color"
            />
          </>
        );

      case 'typography':
        return (
          <>
            <View style={[styles.section, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>Font Family</Text>
              <View style={styles.buttonRow}>
                {['System', 'Inter', 'Roboto', 'Outfit'].map((font) => (
                  <TouchableOpacity
                    key={font}
                    style={[styles.optionButton, { backgroundColor: fontFamily === font ? currentTheme.colors.primary : currentTheme.colors.surface, borderColor: currentTheme.colors.border }, fontFamily === font && styles.optionButtonActive]}
                    onPress={() => setFontFamily(font)}
                  >
                    <Text style={[styles.optionButtonText, { color: fontFamily === font ? '#FFFFFF' : currentTheme.colors.text }, fontFamily === font && styles.optionButtonTextActive]}>>
                      {font}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>Heading Weight</Text>
              <View style={styles.buttonRow}>
                {['400', '500', '600', '700', '800', '900'].map((weight) => (
                  <TouchableOpacity
                    key={weight}
                    style={[styles.optionButton, { backgroundColor: headingWeight === weight ? currentTheme.colors.primary : currentTheme.colors.surface, borderColor: currentTheme.colors.border }, headingWeight === weight && styles.optionButtonActive]}
                    onPress={() => setHeadingWeight(weight)}
                  >
                    <Text style={[styles.optionButtonText, { color: headingWeight === weight ? '#FFFFFF' : currentTheme.colors.text }, headingWeight === weight && styles.optionButtonTextActive]}>
                      {weight}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.label, { color: currentTheme.colors.text }]}>Body Weight</Text>
              <View style={styles.buttonRow}>
                {['400', '500', '600', '700'].map((weight) => (
                  <TouchableOpacity
                    key={weight}
                    style={[styles.optionButton, { backgroundColor: bodyWeight === weight ? currentTheme.colors.primary : currentTheme.colors.surface, borderColor: currentTheme.colors.border }, bodyWeight === weight && styles.optionButtonActive]}
                    onPress={() => setBodyWeight(weight)}
                  >
                    <Text style={[styles.optionButtonText, { color: bodyWeight === weight ? '#FFFFFF' : currentTheme.colors.text }, bodyWeight === weight && styles.optionButtonTextActive]}>
                      {weight}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Font Scale: {(fontScale || 1.0).toFixed(1)}x</Text>
              <Text style={styles.helperText}>Adjust overall text size (0.8x - 1.3x)</Text>
              <View style={styles.sliderContainer}>
                {[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map((scale) => (
                  <TouchableOpacity
                    key={scale}
                    style={[styles.sliderDot, fontScale === scale && styles.sliderDotActive]}
                    onPress={() => setFontScale(scale)}
                  >
                    <Text style={styles.sliderLabel}>{scale.toFixed(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 'buttons':
        return (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Button Shape</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.shapeOption, buttonShape === 'rounded' && styles.optionButtonActive]}
                  onPress={() => setButtonShape('rounded')}
                >
                  <View style={[styles.shapePreview, { borderRadius: 12 }]} />
                  <Text style={[styles.optionButtonText, buttonShape === 'rounded' && styles.optionButtonTextActive]}>
                    Rounded
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.shapeOption, buttonShape === 'pill' && styles.optionButtonActive]}
                  onPress={() => setButtonShape('pill')}
                >
                  <View style={[styles.shapePreview, { borderRadius: 999 }]} />
                  <Text style={[styles.optionButtonText, buttonShape === 'pill' && styles.optionButtonTextActive]}>
                    Pill
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.shapeOption, buttonShape === 'square' && styles.optionButtonActive]}
                  onPress={() => setButtonShape('square')}
                >
                  <View style={[styles.shapePreview, { borderRadius: 4 }]} />
                  <Text style={[styles.optionButtonText, buttonShape === 'square' && styles.optionButtonTextActive]}>
                    Square
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Button Style</Text>
              <View style={styles.buttonRow}>
                {[
                  { value: 'flat', label: 'Flat' },
                  { value: 'gradient', label: 'Gradient' },
                  { value: 'outlined', label: 'Outlined' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionButton, buttonStyle === option.value && styles.optionButtonActive]}
                    onPress={() => setButtonStyle(option.value as any)}
                  >
                    <Text style={[styles.optionButtonText, buttonStyle === option.value && styles.optionButtonTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Button Shadow</Text>
                <Switch value={buttonShadow} onValueChange={setButtonShadow} />
              </View>
              <Text style={styles.helperText}>Add drop shadows to buttons</Text>
            </View>
          </>
        );

      case 'spacing':
        return (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>Spacing Scale: {(spacingScale || 1.0).toFixed(1)}x</Text>
              <Text style={styles.helperText}>Adjust overall spacing and padding</Text>
              <View style={styles.sliderContainer}>
                {[0.8, 0.9, 1.0, 1.2, 1.5].map((scale) => (
                  <TouchableOpacity
                    key={scale}
                    style={[styles.sliderDot, spacingScale === scale && styles.sliderDotActive]}
                    onPress={() => setSpacingScale(scale)}
                  >
                    <Text style={styles.sliderLabel}>{scale.toFixed(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Card Shadow</Text>
              <View style={styles.buttonRow}>
                {[
                  { value: 'none', label: 'None' },
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionButton, cardShadow === option.value && styles.optionButtonActive]}
                    onPress={() => setCardShadow(option.value as any)}
                  >
                    <Text style={[styles.optionButtonText, cardShadow === option.value && styles.optionButtonTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Border Radius Scale: {(borderRadiusScale || 1.0).toFixed(1)}x</Text>
              <Text style={styles.helperText}>Adjust roundness of corners</Text>
              <View style={styles.sliderContainer}>
                {[0.5, 0.8, 1.0, 1.5, 2.0].map((scale) => (
                  <TouchableOpacity
                    key={scale}
                    style={[styles.sliderDot, borderRadiusScale === scale && styles.sliderDotActive]}
                    onPress={() => setBorderRadiusScale(scale)}
                  >
                    <Text style={styles.sliderLabel}>{scale.toFixed(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 'dark':
        return (
          <>
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Enable Dark Mode</Text>
                <Switch value={darkModeEnabled} onValueChange={setDarkModeEnabled} />
              </View>
              <Text style={styles.helperText}>
                Allow users to switch to a dark theme
              </Text>
            </View>

            {darkModeEnabled && (
              <>
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.autoGenerateButton}
                    onPress={autoGenerateDarkTheme}
                  >
                    <Palette size={20} color="#3B82F6" />
                    <Text style={styles.autoGenerateText}>Auto-Generate Dark Theme</Text>
                  </TouchableOpacity>
                  <Text style={styles.helperText}>
                    Or customize dark mode colors below
                  </Text>
                </View>

                <VisualColorPicker
                  label="Dark Primary Color"
                  value={darkPrimaryColor || primaryColor}
                  onPress={() => openColorPicker('darkPrimary', darkPrimaryColor || primaryColor)}
                  helper="Leave empty to auto-generate"
                />
                <VisualColorPicker
                  label="Dark Secondary Color"
                  value={darkSecondaryColor || secondaryColor}
                  onPress={() => openColorPicker('darkSecondary', darkSecondaryColor || secondaryColor)}
                  helper="Leave empty to auto-generate"
                />
                <VisualColorPicker
                  label="Dark Accent Color"
                  value={darkAccentColor || accentColor}
                  onPress={() => openColorPicker('darkAccent', darkAccentColor || accentColor)}
                  helper="Leave empty to auto-generate"
                />
                <VisualColorPicker
                  label="Dark Background Color"
                  value={darkBackgroundColor || '#1F2937'}
                  onPress={() => openColorPicker('darkBackground', darkBackgroundColor || '#1F2937')}
                  helper="Dark mode background"
                />
              </>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: currentTheme.colors.surface, borderBottomColor: currentTheme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Brand Settings</Text>
        <TouchableOpacity onPress={() => setShowPreview(!showPreview)} style={styles.headerPreviewButton}>
          <Eye size={20} color={showPreview ? "#3B82F6" : "#6B7280"} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { backgroundColor: currentTheme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'identity' && { borderBottomColor: currentTheme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('identity')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'identity' ? currentTheme.colors.primary : currentTheme.colors.textSecondary }, activeTab === 'identity' && styles.tabTextActive]}>Identity</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'colors' && { borderBottomColor: currentTheme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('colors')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'colors' ? currentTheme.colors.primary : currentTheme.colors.textSecondary }, activeTab === 'colors' && styles.tabTextActive]}>Colors</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'typography' && { borderBottomColor: currentTheme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('typography')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'typography' ? currentTheme.colors.primary : currentTheme.colors.textSecondary }, activeTab === 'typography' && styles.tabTextActive]}>Typography</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'buttons' && { borderBottomColor: currentTheme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('buttons')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'buttons' ? currentTheme.colors.primary : currentTheme.colors.textSecondary }, activeTab === 'buttons' && styles.tabTextActive]}>Buttons</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'spacing' && { borderBottomColor: currentTheme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('spacing')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'spacing' ? currentTheme.colors.primary : currentTheme.colors.textSecondary }, activeTab === 'spacing' && styles.tabTextActive]}>Spacing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'dark' && { borderBottomColor: currentTheme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('dark')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'dark' ? currentTheme.colors.primary : currentTheme.colors.textSecondary }, activeTab === 'dark' && styles.tabTextActive]}>Dark Mode</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.content}>
        {renderTabContent()}

        {/* Live Preview */}
        {showPreview && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Live Preview</Text>
            
            <View style={[styles.previewCard, { backgroundColor: backgroundColor }]}>
              {logoUrl && (
                <Image source={{ uri: logoUrl }} style={styles.previewLogo} />
              )}
              <Text style={[styles.previewBrandName, { fontFamily, fontWeight: headingWeight as any }]}>
                {brandName || 'Your Brand'}
              </Text>
              
              <View style={styles.previewButtons}>
                <View
                  style={[
                    styles.previewButton,
                    {
                      backgroundColor: primaryColor,
                      borderRadius: buttonShape === 'rounded' ? 12 : buttonShape === 'pill' ? 999 : 4,
                    },
                  ]}
                >
                  <Text style={[styles.previewButtonText, { fontFamily }]}>Primary Button</Text>
                </View>
                <View
                  style={[
                    styles.previewButton,
                    {
                      backgroundColor: secondaryColor,
                      borderRadius: buttonShape === 'rounded' ? 12 : buttonShape === 'pill' ? 999 : 4,
                    },
                  ]}
                >
                  <Text style={[styles.previewButtonText, { fontFamily }]}>Secondary Button</Text>
                </View>
              </View>

              <View style={styles.previewAvatarRow}>
                <View style={[styles.previewAvatar, { backgroundColor: primaryColor }]}>
                  <Text style={styles.previewAvatarText}>JD</Text>
                </View>
                <View style={styles.previewAvatarInfo}>
                  <Text style={[styles.previewAvatarName, { fontFamily, fontWeight: headingWeight as any }]}>
                    John Doe
                  </Text>
                  <Text style={[styles.previewAvatarRole, { fontFamily }]}>Client Avatar</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: currentTheme.colors.primary }, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Color Picker Modal */}
        <ColorPickerModal
          visible={showColorPicker}
          currentColor={
            activeColorField === 'primary' ? primaryColor :
            activeColorField === 'secondary' ? secondaryColor :
            activeColorField === 'accent' ? accentColor :
            activeColorField === 'background' ? backgroundColor :
            activeColorField === 'darkPrimary' ? (darkPrimaryColor || primaryColor) :
            activeColorField === 'darkSecondary' ? (darkSecondaryColor || secondaryColor) :
            activeColorField === 'darkAccent' ? (darkAccentColor || accentColor) :
            (darkBackgroundColor || '#1F2937')
          }
          onClose={() => setShowColorPicker(false)}
          onColorSelected={handleColorChange}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// Visual Color Picker Component (Button that opens modal)
function VisualColorPicker({ label, value, onPress, helper }: { label: string; value: string; onPress: () => void; helper?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      {helper && <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>{helper}</Text>}
      <TouchableOpacity
        style={[styles.colorPickerButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={onPress}
      >
        <View style={[styles.colorPreviewLarge, { backgroundColor: value }]} />
        <Text style={[styles.colorPickerButtonText, { color: theme.colors.text }]}>{value.toUpperCase()}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Color Picker Modal Component  
function ColorPickerModal({ visible, currentColor, onClose, onColorSelected }: {
  visible: boolean;
  currentColor: string;
  onClose: () => void;
  onColorSelected: (color: string) => void;
}) {
  const [selectedColor, setSelectedColor] = React.useState(currentColor);

  React.useEffect(() => {
    setSelectedColor(currentColor);
  }, [currentColor]);

  const handleConfirm = () => {
    onColorSelected(selectedColor);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.colorPickerModal}>
          <View style={styles.colorPickerModalHeader}>
            <Text style={styles.colorPickerModalTitle}>Choose Color</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.colorPickerModalClose}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.colorPickerContainer}>
            <ColorPicker
              color={selectedColor}
              onColorChange={(color: string) => setSelectedColor(color)}
              onColorChangeComplete={(color: string) => setSelectedColor(color)}
              thumbSize={30}
              sliderSize={30}
              noSnap={true}
              row={false}
            />
          </View>

          <View style={styles.colorPreviewSection}>
            <View style={[styles.colorPreviewBox, { backgroundColor: selectedColor }]} />
            <Text style={styles.colorPreviewText}>{selectedColor.toUpperCase()}</Text>
          </View>

          <TouchableOpacity style={styles.colorPickerConfirmButton} onPress={handleConfirm}>
            <Text style={styles.colorPickerConfirmText}>Select Color</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerPreviewButton: {
    padding: 4,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 8,
    maxHeight: 48,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 20,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  logoPreviewContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  colorInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  colorInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  optionButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
  },
  shapeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    gap: 8,
  },
  shapePreview: {
    width: 40,
    height: 24,
    backgroundColor: '#3B82F6',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sliderDot: {
    alignItems: 'center',
    gap: 4,
  },
  sliderDotActive: {
    transform: [{ scale: 1.2 }],
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  presetColors: {
    flexDirection: 'row',
    gap: 4,
  },
  presetColorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  autoGenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  autoGenerateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  previewSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 16,
  },
  previewLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  previewBrandName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  previewButtons: {
    width: '100%',
    gap: 12,
  },
  previewButton: {
    padding: 16,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  previewAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewAvatarInfo: {
    flex: 1,
  },
  previewAvatarName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  previewAvatarRole: {
    fontSize: 12,
    color: '#6B7280',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  noPermissionText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  previewLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  brandNamePreview: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  // Color Picker Styles
  colorPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },
  colorPreviewLarge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 12,
  },
  colorPickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  colorPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  colorPickerModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  colorPickerModalClose: {
    fontSize: 32,
    color: '#6B7280',
    fontWeight: '300',
  },
  colorPickerContainer: {
    height: 300,
    marginBottom: 20,
  },
  colorPreviewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  colorPreviewBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginRight: 16,
  },
  colorPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  colorPickerConfirmButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  colorPickerConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
