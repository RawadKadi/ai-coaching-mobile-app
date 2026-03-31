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
  SafeAreaView,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Upload, Save, Eye, Palette, Check, Home, Users, MessageSquare as MessageCircle, Calendar, Settings, X, TrendingUp, CheckCircle, Target, Sparkles, ChevronRight, LayoutGrid, Type, Square, LayoutTemplate, Moon, Sliders, ShieldAlert } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { AVAILABLE_FONTS, getFontFamily } from '@/hooks/useAppFonts';

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
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'identity' | 'colors' | 'typography' | 'buttons' | 'spacing' | 'dark'>('identity');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
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
      <View style={[styles.container, { backgroundColor: '#020617' }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.roundIconButton, { borderColor: '#ffffff15', backgroundColor: '#ffffff08' }]}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.premiumHeaderTitle}>View Only</Text>
            <View style={styles.premiumBadge}>
              <Text style={[styles.premiumBadgeText, { color: primaryColor }]}>RESTRICTED</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={[styles.card, { marginTop: 24, alignItems: 'center' }]}>
            <ShieldAlert size={48} color={primaryColor} style={{ marginBottom: 16 }} />
            <Text style={[styles.cardTitle, { color: '#FFFFFF', textAlign: 'center' }]}>Access Restricted</Text>
            <Text style={[styles.helperText, { color: '#94A3B8', textAlign: 'center', marginTop: 8 }]}>
              These brand settings are managed at the Headquarters level. Contact your administrator to request changes.
            </Text>
            
            {brand && (
              <View style={[styles.logoPreviewContainer, { width: '100%', borderTopWidth: 1, borderTopColor: '#ffffff08', paddingTop: 20, marginTop: 20 }]}>
                <Text style={[styles.label, { color: '#64748B', marginBottom: 16 }]}>CURRENT BRAND IDENTITY</Text>
                {brand.logo_url && (
                  <Image 
                    source={{ uri: brand.logo_url }} 
                    style={styles.logoPreview} 
                    contentFit="contain"
                    transition={200}
                    cachePolicy="disk"
                  />
                )}
                <Text style={[styles.premiumHeaderTitle, { marginTop: 12, fontSize: 24 }]}>{brand.name}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
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
    setSelectedPreset(presetKey);
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
    const content = (() => {
      switch (activeTab) {
        case 'identity':
          return (
            <MotiView 
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              key="identity"
              style={styles.tabContent}
            >
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <LayoutGrid size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Identity</Text>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Brand Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#1E293B', borderColor: '#334155', color: '#FFFFFF' }]}
                    placeholder="e.g., Elite Fitness Gym"
                    value={brandName}
                    onChangeText={setBrandName}
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={[styles.formGroup, { marginTop: 12 }]}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Brand Logo</Text>
                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                    onPress={pickImage}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={primaryColor} />
                    ) : (
                      <>
                        <Upload size={18} color={primaryColor} />
                        <Text style={[styles.uploadButtonText, { color: primaryColor }]}>
                          {logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  {logoUrl && (
                    <View style={styles.logoPreviewContainer}>
                      <Image 
                        source={{ uri: logoUrl }} 
                        style={styles.logoPreview} 
                        contentFit="contain"
                        transition={200}
                        cachePolicy="disk"
                      />
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <LayoutTemplate size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Quick Presets</Text>
                </View>
                <Text style={[styles.helperText, { color: '#94A3B8' }]}>
                  Apply a preset theme to quickly establish your brand identity
                </Text>
                
                <View style={styles.presetGrid}>
                  {Object.entries(PRESET_THEMES).map(([key, preset]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.presetCard,
                        { backgroundColor: '#1E293B', borderColor: '#334155' },
                        selectedPreset === key && { borderColor: primaryColor, borderWidth: 2 }
                      ]}
                      onPress={() => applyPreset(key as keyof typeof PRESET_THEMES)}
                    >
                      {selectedPreset === key && (
                        <View style={[styles.presetSelectedCheck, { backgroundColor: primaryColor }]}>
                          <Check size={10} color="#FFFFFF" />
                        </View>
                      )}
                      <View style={styles.presetColors}>
                        <View style={[styles.presetColorDot, { backgroundColor: preset.primary_color }]} />
                        <View style={[styles.presetColorDot, { backgroundColor: preset.secondary_color }]} />
                        <View style={[styles.presetColorDot, { backgroundColor: preset.background_color, borderWidth: 1, borderColor: '#333' }]} />
                      </View>
                      <Text style={[styles.presetName, { color: '#FFFFFF' }]}>{preset.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </MotiView>
          );

        case 'colors':
          return (
            <MotiView 
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              key="colors"
              style={styles.tabContent}
            >
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <Palette size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Color System</Text>
                </View>
                
                <VisualColorPicker
                  label="Primary Color"
                  value={primaryColor}
                  onPress={() => openColorPicker('primary', primaryColor)}
                  helper="Main Action buttons"
                />
                <VisualColorPicker
                  label="Secondary Color"
                  value={secondaryColor}
                  onPress={() => openColorPicker('secondary', secondaryColor)}
                  helper="Supporting accent elements"
                />
                <VisualColorPicker
                  label="Accent Color"
                  value={accentColor}
                  onPress={() => openColorPicker('accent', accentColor)}
                  helper="Highlights and badges"
                />
                <VisualColorPicker
                  label="Background Color"
                  value={backgroundColor}
                  onPress={() => openColorPicker('background', backgroundColor)}
                  helper="Core dashboard background"
                />
              </View>
            </MotiView>
          );

        case 'typography':
          return (
            <MotiView 
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              key="typography"
              style={styles.tabContent}
            >
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <Type size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Typography</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Font Family</Text>
                  <TouchableOpacity 
                    style={[styles.fontSelectButton, { backgroundColor: '#1E293B', borderColor: '#334155' }]}
                    onPress={() => setShowFontPicker(true)}
                  >
                    <Text style={[styles.fontSelectButtonText, { fontFamily: getFontFamily(fontFamily), color: '#FFFFFF' }]}>
                      {fontFamily || 'Select Font'}
                    </Text>
                    <ChevronRight size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.formGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Heading Weight</Text>
                  <View style={styles.buttonRow}>
                    {['400', '500', '600', '700', '900'].map((weight) => (
                      <TouchableOpacity
                        key={weight}
                        style={[styles.optionButton, { backgroundColor: headingWeight === weight ? primaryColor : '#1E293B', borderColor: '#334155' }]}
                        onPress={() => setHeadingWeight(weight)}
                      >
                        <Text style={[styles.optionButtonText, { color: headingWeight === weight ? '#FFFFFF' : '#94A3B8' }]}>
                          {weight}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.formGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Body Weight</Text>
                  <View style={styles.buttonRow}>
                    {['400', '500', '600', '700'].map((weight) => (
                      <TouchableOpacity
                        key={weight}
                        style={[styles.optionButton, { backgroundColor: bodyWeight === weight ? primaryColor : '#1E293B', borderColor: '#334155' }]}
                        onPress={() => setBodyWeight(weight)}
                      >
                        <Text style={[styles.optionButtonText, { color: bodyWeight === weight ? '#FFFFFF' : '#94A3B8' }]}>
                          {weight}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.formGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Font Scale: {(fontScale || 1.0).toFixed(1)}x</Text>
                  <View style={styles.sliderContainer}>
                    {[0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map((scale) => (
                      <TouchableOpacity
                        key={scale}
                        style={[styles.sliderDot, fontScale === scale && { backgroundColor: primaryColor, transform: [{ scale: 1.2 }] }]}
                        onPress={() => setFontScale(scale)}
                      >
                        <Text style={[styles.sliderLabel, { color: fontScale === scale ? primaryColor : '#64748B' }]}>{scale.toFixed(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </MotiView>
          );

        case 'buttons':
          return (
            <MotiView 
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              key="buttons"
              style={styles.tabContent}
            >
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <Square size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Button Controls</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Button Shape</Text>
                  <View style={styles.buttonRow}>
                    {[
                      { id: 'rounded', label: 'Rounded', icon: <View style={[styles.shapePreview, { borderRadius: 8 }]} /> },
                      { id: 'pill', label: 'Pill', icon: <View style={[styles.shapePreview, { borderRadius: 16 }]} /> },
                      { id: 'square', label: 'Square', icon: <View style={[styles.shapePreview, { borderRadius: 0 }]} /> },
                    ].map((shape) => (
                      <TouchableOpacity
                        key={shape.id}
                        style={[
                          styles.shapeOption,
                          { backgroundColor: '#1E293B', borderColor: '#334155' },
                          buttonShape === shape.id && { borderColor: primaryColor, borderWidth: 2 }
                        ]}
                        onPress={() => setButtonShape(shape.id as any)}
                      >
                        <View style={[styles.shapePreview, { backgroundColor: buttonShape === shape.id ? primaryColor : '#64748B' }]} />
                        <Text style={[styles.optionButtonText, { color: buttonShape === shape.id ? '#FFFFFF' : '#94A3B8' }]}>
                          {shape.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.formGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Initial Style Preset</Text>
                  <View style={styles.buttonRow}>
                    {['flat', 'gradient', 'outlined'].map((style) => (
                      <TouchableOpacity
                        key={style}
                        style={[
                          styles.optionButton,
                          { backgroundColor: buttonStyle === style ? primaryColor : '#1E293B', borderColor: '#334155' }
                        ]}
                        onPress={() => setButtonStyle(style as any)}
                      >
                        <Text style={[styles.optionButtonText, { color: buttonStyle === style ? '#FFFFFF' : '#94A3B8', textTransform: 'capitalize' }]}>
                          {style}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.switchRow, { marginTop: 16 }]}>
                  <View>
                    <Text style={[styles.label, { color: '#FFFFFF', marginBottom: 0 }]}>Button Shadows</Text>
                    <Text style={[styles.helperText, { color: '#94A3B8', marginBottom: 0 }]}>Add dynamic depth to buttons</Text>
                  </View>
                  <Switch
                    value={buttonShadow}
                    onValueChange={setButtonShadow}
                    trackColor={{ false: '#1E293B', true: primaryColor }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            </MotiView>
          );

        case 'spacing':
          return (
            <MotiView 
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              key="spacing"
              style={styles.tabContent}
            >
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <Sliders size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Dimension & Scale</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Base Spacing: {spacingScale.toFixed(1)}x</Text>
                  <View style={styles.sliderContainer}>
                    {[0.8, 0.9, 1.0, 1.2, 1.5].map((scale) => (
                      <TouchableOpacity
                        key={scale}
                        style={[styles.sliderDot, spacingScale === scale && { backgroundColor: primaryColor, transform: [{ scale: 1.2 }] }]}
                        onPress={() => setSpacingScale(scale)}
                      >
                        <Text style={[styles.sliderLabel, { color: spacingScale === scale ? primaryColor : '#64748B' }]}>{scale.toFixed(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.formGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: '#94A3B8' }]}>Default Lift (Shadows)</Text>
                  <View style={styles.buttonRow}>
                    {['none', 'small', 'medium', 'large'].map((shadow) => (
                      <TouchableOpacity
                        key={shadow}
                        style={[
                          styles.optionButton,
                          { backgroundColor: cardShadow === shadow ? primaryColor : '#1E293B', borderColor: '#334155' }
                        ]}
                        onPress={() => setCardShadow(shadow as any)}
                      >
                        <Text style={[styles.optionButtonText, { color: cardShadow === shadow ? '#FFFFFF' : '#94A3B8', textTransform: 'capitalize' }]}>
                          {shadow}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </MotiView>
          );

        case 'dark':
          return (
            <MotiView 
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              key="dark"
              style={styles.tabContent}
            >
              <View style={[styles.card, { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
                <View style={styles.cardHeader}>
                  <Moon size={20} color={primaryColor} />
                  <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Night Protocol</Text>
                </View>

                <View style={styles.switchRow}>
                  <View>
                    <Text style={[styles.label, { color: '#FFFFFF', marginBottom: 0 }]}>Enable Dark Theme</Text>
                    <Text style={[styles.helperText, { color: '#94A3B8', marginBottom: 0 }]}>Allow the AI to switch to dark mode</Text>
                  </View>
                  <Switch 
                    value={darkModeEnabled} 
                    onValueChange={setDarkModeEnabled}
                    trackColor={{ false: '#1E293B', true: primaryColor }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {darkModeEnabled && (
                  <View style={{ marginTop: 24, gap: 16 }}>
                    <TouchableOpacity
                      style={[styles.autoGenerateButton, { backgroundColor: primaryColor + '10', borderColor: primaryColor + '40' }]}
                      onPress={autoGenerateDarkTheme}
                    >
                      <Palette size={18} color={primaryColor} />
                      <Text style={[styles.autoGenerateText, { color: primaryColor }]}>Auto-Generate Variations</Text>
                    </TouchableOpacity>

                    <VisualColorPicker
                      label="Night Primary"
                      value={darkPrimaryColor || primaryColor}
                      onPress={() => openColorPicker('darkPrimary', darkPrimaryColor || primaryColor)}
                    />
                    <VisualColorPicker
                      label="Night Secondary"
                      value={darkSecondaryColor || secondaryColor}
                      onPress={() => openColorPicker('darkSecondary', darkSecondaryColor || secondaryColor)}
                    />
                    <VisualColorPicker
                      label="Night Background"
                      value={darkBackgroundColor || '#020617'}
                      onPress={() => openColorPicker('darkBackground', darkBackgroundColor || '#020617')}
                    />
                  </View>
                )}
              </View>
            </MotiView>
          );

        default:
          return null;
      }
    })();

    return (
      <View style={styles.contentContainer}>
        {content}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#020617' }]}>
      <StatusBar style="light" />
      
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.roundIconButton, { backgroundColor: '#ffffff10', borderColor: '#ffffff20' }]}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.premiumHeaderTitle}>Brand Lab</Text>
          <View style={styles.premiumBadge}>
            <Sparkles size={10} color={primaryColor} />
            <Text style={[styles.premiumBadgeText, { color: primaryColor }]}>HQ PROTOCOL</Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={() => setShowFullPreview(true)} 
          style={[styles.roundIconButton, { backgroundColor: primaryColor + '20', borderColor: primaryColor + '40' }]}
        >
          <Eye size={20} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Modern Scrolling Tabs */}
      <View style={styles.tabBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          <TabItem 
            active={activeTab === 'identity'} 
            label="Identity" 
            onPress={() => setActiveTab('identity')} 
            icon={<LayoutGrid size={16} color={activeTab === 'identity' ? '#FFFFFF' : '#94A3B8'} />}
          />
          <TabItem 
            active={activeTab === 'colors'} 
            label="Colors" 
            onPress={() => setActiveTab('colors')} 
            icon={<Palette size={16} color={activeTab === 'colors' ? '#FFFFFF' : '#94A3B8'} />}
          />
          <TabItem 
            active={activeTab === 'typography'} 
            label="Type" 
            onPress={() => setActiveTab('typography')} 
            icon={<Type size={16} color={activeTab === 'typography' ? '#FFFFFF' : '#94A3B8'} />}
          />
          <TabItem 
            active={activeTab === 'buttons'} 
            label="Controls" 
            onPress={() => setActiveTab('buttons')} 
            icon={<Square size={16} color={activeTab === 'buttons' ? '#FFFFFF' : '#94A3B8'} />}
          />
          <TabItem 
            active={activeTab === 'spacing'} 
            label="Grid" 
            onPress={() => setActiveTab('spacing')} 
            icon={<Sliders size={16} color={activeTab === 'spacing' ? '#FFFFFF' : '#94A3B8'} />}
          />
          <TabItem 
            active={activeTab === 'dark'} 
            label="Night" 
            onPress={() => setActiveTab('dark')} 
            icon={<Moon size={16} color={activeTab === 'dark' ? '#FFFFFF' : '#94A3B8'} />}
          />
        </ScrollView>
      </View>

      <ScrollView 
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {renderTabContent()}

        {/* Floating Action Bar */}
      </ScrollView>

      {/* Gradient Bottom Save Button */}
      <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={[styles.saveButtonMain, { backgroundColor: '#2563EB' }, loading && { opacity: 0.7 }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.saveButtonContent}>
              <Save size={20} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.saveButtonTextMain}>Commit Changes</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Pre-existing Modals */}
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
          (darkBackgroundColor || '#020617')
        }
        onClose={() => setShowColorPicker(false)}
        onColorSelected={handleColorChange}
      />

      <FontPickerModal 
        visible={showFontPicker} 
        active={fontFamily} 
        onClose={() => setShowFontPicker(false)} 
        onSelect={(font: string) => {
          setFontFamily(font);
          setShowFontPicker(false);
        }}
        primaryColor={primaryColor}
        theme={currentTheme}
      />

      {/* Full Preview Modal Content - Keeping original logic but could be restyled */}
      <Modal visible={showFullPreview} animationType="slide" presentationStyle="fullScreen">
        <FullPreviewContent 
          brandName={brandName} 
          logoUrl={logoUrl} 
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
          backgroundColor={backgroundColor}
          fontFamily={fontFamily}
          headingWeight={headingWeight}
          darkModeEnabled={darkModeEnabled}
          onClose={() => setShowFullPreview(false)}
        />
      </Modal>
    </View>
  );
}

// Sub-components for cleaner code
function TabItem({ active, label, onPress, icon }: any) {
  const blueBrand = '#2563EB'; // The "exact blue" brand color
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[
        styles.tabItem, 
        active && { backgroundColor: blueBrand }
      ]}
    >
      {React.cloneElement(icon, { color: active ? '#FFFFFF' : '#94A3B8', size: 18 })}
      <Text style={[styles.tabLabel, { color: active ? '#FFFFFF' : '#94A3B8' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FontPickerModal({ visible, active, onClose, onSelect, primaryColor, theme }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBlurOverlay}>
        <View style={[styles.premiumBottomModal, { backgroundColor: '#020617', borderColor: '#ffffff10' }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Identity Font</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.fontList} showsVerticalScrollIndicator={false}>
            {AVAILABLE_FONTS.map((font) => (
              <TouchableOpacity
                key={font.name}
                style={[
                  styles.fontListItem,
                  active === font.name && { backgroundColor: primaryColor + '20', borderColor: primaryColor + '40' }
                ]}
                onPress={() => onSelect(font.name)}
              >
                <View>
                  <Text 
                    style={[
                      styles.fontListText,
                      { 
                        fontFamily: font.fontFamily !== 'System' ? font.fontFamily : undefined,
                        color: active === font.name ? primaryColor : '#F8FAFC',
                      }
                    ]}
                  >
                    {font.name}
                  </Text>
                  <Text style={styles.fontListPreview}>The quick brown fox jumps over the lazy dog</Text>
                </View>
                {active === font.name && <CheckCircle size={20} color={primaryColor} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Move Full Preview to separate component to clean up main screen
function FullPreviewContent({ brandName, logoUrl, primaryColor, secondaryColor, accentColor, backgroundColor, fontFamily, headingWeight, darkModeEnabled, onClose }: any) {
  return (
    <SafeAreaView style={[styles.fullPreviewContainer, { backgroundColor: backgroundColor }]}>
      <TouchableOpacity style={styles.fullPreviewCloseButton} onPress={onClose}>
        <View style={[styles.fullPreviewCloseIcon, { backgroundColor: primaryColor }]}>
          <X size={20} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <View style={[styles.fullPreviewHeader, { backgroundColor: darkModeEnabled ? '#1F2937' : '#FFFFFF', borderBottomColor: darkModeEnabled ? '#374151' : '#E5E7EB' }]}>
        <Text style={[styles.fullPreviewGreeting, { fontFamily, fontWeight: headingWeight as any, color: darkModeEnabled ? '#F9FAFB' : '#111827' }]}>
          Welcome back!
        </Text>
        <Text style={[styles.fullPreviewSubtitle, { fontFamily, color: darkModeEnabled ? '#9CA3AF' : '#6B7280' }]}>
          Your Brand Identity
        </Text>
      </View>

      <ScrollView style={styles.fullPreviewContent}>
        <View style={styles.fullPreviewStatsGrid}>
          <StatBox label="Total Impact" value="1.2k" color={primaryColor} icon={<Users size={20} color={primaryColor} />} />
          <StatBox label="Growth" value="24%" color={secondaryColor} icon={<TrendingUp size={20} color={secondaryColor} />} />
        </View>

        <View style={styles.fullPreviewSection}>
          <Text style={[styles.fullPreviewSectionTitle, { color: darkModeEnabled ? '#F9FAFB' : '#111827' }]}>Recent Activity</Text>
          <View style={[styles.fullPreviewEmptyState, { backgroundColor: darkModeEnabled ? '#374151' : '#FFFFFF' }]}>
            <Text style={{ color: darkModeEnabled ? '#9CA3AF' : '#6B7280' }}>Dashboard simulation active</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color, icon }: any) {
  return (
    <View style={styles.fullPreviewStatCard}>
      <View style={[styles.fullPreviewStatIcon, { backgroundColor: color + '20' }]}>{icon}</View>
      <Text style={styles.fullPreviewStatValue}>{value}</Text>
      <Text style={styles.fullPreviewStatLabel}>{label}</Text>
    </View>
  );
}

// Visual Color Picker Component (Button that opens modal)
function VisualColorPicker({ label, value, onPress, helper }: { label: string; value: string; onPress: () => void; helper?: string }) {
  return (
    <View style={styles.colorPickerGroup}>
      <View style={styles.colorPickerLabelRow}>
        <Text style={[styles.label, { color: '#FFFFFF', marginBottom: 0 }]}>{label}</Text>
        <Text style={[styles.colorHexCode, { color: '#94A3B8' }]}>{value.toUpperCase()}</Text>
      </View>
      <TouchableOpacity
        style={[styles.colorTrigger, { backgroundColor: '#1E293B', borderColor: '#334155' }]}
        onPress={onPress}
      >
        <View style={[styles.colorChip, { backgroundColor: value }]} />
        <Text style={[styles.colorTriggerText, { color: '#FFFFFF' }]}>Adjust Shade</Text>
        <ChevronRight size={16} color="#94A3B8" />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  premiumHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff08',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tabBarContainer: {
    height: 60,
    marginBottom: 8,
  },
  tabBarScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff08',
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  tabContent: {
    gap: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  uploadButton: {
    height: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  logoPreviewContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  logoPreview: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    opacity: 0.6,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  presetSelectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  presetColors: {
    flexDirection: 'row',
    gap: -8,
  },
  presetColorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  presetName: {
    fontSize: 12,
    fontWeight: '700',
  },
  colorPickerGroup: {
    marginBottom: 20,
  },
  colorPickerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorHexCode: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  colorTrigger: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  colorTriggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  fontSelectButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  fontSelectButtonText: {
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 10,
  },
  sliderDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff08',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  shapeOption: {
    flex: 1,
    height: 70,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  shapePreview: {
    width: 36,
    height: 18,
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoGenerateButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  autoGenerateText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: '#020617ee',
    borderTopWidth: 1,
    borderTopColor: '#ffffff08',
  },
  saveButtonMain: {
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveButtonTextMain: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBlurOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  premiumBottomModal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ffffff20',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff08',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontList: {
    paddingHorizontal: 16,
  },
  fontListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fontListText: {
    fontSize: 18,
    fontWeight: '600',
  },
  fontListPreview: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModal: {
    backgroundColor: '#0F172A',
    borderRadius: 32,
    padding: 24,
    width: '90%',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  colorPickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  colorPickerModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  colorPickerModalClose: {
    fontSize: 28,
    color: '#94A3B8',
  },
  colorPickerContainer: {
    height: 280,
    marginBottom: 24,
  },
  colorPreviewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  colorPreviewBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  colorPreviewText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  colorPickerConfirmButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  fullPreviewContainer: {
    flex: 1,
  },
  fullPreviewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
  },
  fullPreviewCloseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  fullPreviewHeader: {
    padding: 24,
    paddingTop: 80,
    borderBottomWidth: 1,
  },
  fullPreviewGreeting: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  fullPreviewSubtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  fullPreviewContent: {
    padding: 20,
  },
  fullPreviewStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  fullPreviewStatCard: {
    flex: 1,
    backgroundColor: '#ffffff08',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  fullPreviewStatIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullPreviewStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  fullPreviewStatLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  fullPreviewSection: {
    marginBottom: 24,
  },
  fullPreviewSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  fullPreviewEmptyState: {
    padding: 30,
    borderRadius: 24,
    backgroundColor: '#ffffff05',
    borderWidth: 1,
    borderColor: '#ffffff08',
    alignItems: 'center',
  },
});
