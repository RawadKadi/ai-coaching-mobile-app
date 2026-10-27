import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Save,
  Eye,
  Palette,
  Check,
  LayoutGrid,
  Type,
  ShieldAlert,
  Trash2,
  Sparkles,
  X,
  Users,
  TrendingUp,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useBrand, useTheme, Brand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';
import ColorPicker from 'react-native-wheel-color-picker';
import { AVAILABLE_FONTS, getFontFamily } from '@/hooks/useAppFonts';
import { safeBack } from '@/lib/navigation-utils';

// Preset themes (colors & palettes)
const PRESET_THEMES: Record<
  string,
  {
    name: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_color: string;
    font_family?: string;
  }
> = {
  modernBlue: {
    name: 'Modern Blue',
    primary_color: '#2563EB',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    background_color: '#0B132B',
  },
  deepNavy: {
    name: 'Deep Navy',
    primary_color: '#7FA7FF',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    background_color: '#010417',
  },
  cleanLight: {
    name: 'Clean Light',
    primary_color: '#2563EB',
    secondary_color: '#059669',
    accent_color: '#D97706',
    background_color: '#F8FAFB',
  },
  energeticOrange: {
    name: 'Energetic Orange',
    primary_color: '#EA580C',
    secondary_color: '#0891B2',
    accent_color: '#84CC16',
    background_color: '#1C1917',
  },
  calmGreen: {
    name: 'Calm Green',
    primary_color: '#059669',
    secondary_color: '#0EA5E9',
    accent_color: '#F59E0B',
    background_color: '#064E3B',
  },
  premiumPurple: {
    name: 'Premium Purple',
    primary_color: '#7C3AED',
    secondary_color: '#EC4899',
    accent_color: '#F59E0B',
    background_color: '#170E2B',
  },
};

type ViewMode = 'overview' | 'identity' | 'colors' | 'font';

export default function BrandSettingsScreen() {
  const router = useRouter();
  const { brand, canManageBrand, updateBrandSettings, refreshBrand } = useBrand();
  const currentTheme = useTheme();
  const { coach } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Color picker modal state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeColorField, setActiveColorField] = useState<
    'primary' | 'secondary' | 'accent' | 'background'
  >('primary');

  // Form state - Identity
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Form state - Colors
  const [primaryColor, setPrimaryColor] = useState('#7FA7FF');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [backgroundColor, setBackgroundColor] = useState('#010417');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('deepNavy');

  // Form state - Typography
  const [fontFamily, setFontFamily] = useState('System');
  const [headingWeight, setHeadingWeight] = useState('700');
  const [bodyWeight, setBodyWeight] = useState('400');
  const [fontScale, setFontScale] = useState(1.0);

  // Hidden preserved system properties (preserved for DB integrity)
  const [buttonShape, setButtonShape] = useState<'rounded' | 'pill' | 'square'>('rounded');
  const [buttonStyle, setButtonStyle] = useState<'flat' | 'gradient' | 'outlined'>('flat');
  const [buttonShadow, setButtonShadow] = useState(false);
  const [spacingScale, setSpacingScale] = useState(1.0);
  const [cardShadow, setCardShadow] = useState<'none' | 'small' | 'medium' | 'large'>('medium');
  const [borderRadiusScale, setBorderRadiusScale] = useState(1.0);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [darkPrimaryColor, setDarkPrimaryColor] = useState('');
  const [darkSecondaryColor, setDarkSecondaryColor] = useState('');
  const [darkAccentColor, setDarkAccentColor] = useState('');
  const [darkBackgroundColor, setDarkBackgroundColor] = useState('');

  // Load brand data
  useEffect(() => {
    if (brand) {
      setBrandName(brand.name || '');
      setLogoUrl(brand.logo_url || '');
      setPrimaryColor(brand.primary_color || '#7FA7FF');
      setSecondaryColor(brand.secondary_color || '#10B981');
      setAccentColor(brand.accent_color || '#F59E0B');
      setBackgroundColor(brand.background_color || '#010417');
      setFontFamily(brand.font_family || 'System');
      setHeadingWeight(brand.heading_font_weight || '700');
      setBodyWeight(brand.body_font_weight || '400');
      setFontScale(brand.font_scale || 1.0);
      setButtonShape(brand.button_shape || 'rounded');
      setButtonStyle(brand.button_style || 'flat');
      setButtonShadow(brand.button_shadow_enabled ?? false);
      setSpacingScale(brand.spacing_scale || 1.0);
      setCardShadow(brand.card_shadow || 'medium');
      setBorderRadiusScale(brand.border_radius_scale || 1.0);
      setDarkModeEnabled(brand.dark_mode_enabled ?? false);
      setDarkPrimaryColor(brand.dark_primary_color || '');
      setDarkSecondaryColor(brand.dark_secondary_color || '');
      setDarkAccentColor(brand.dark_accent_color || '');
      setDarkBackgroundColor(brand.dark_background_color || '');

      // Check matching preset
      const match = Object.entries(PRESET_THEMES).find(
        ([_, p]) =>
          p.primary_color.toLowerCase() === (brand.primary_color || '').toLowerCase() &&
          p.background_color.toLowerCase() === (brand.background_color || '').toLowerCase()
      );
      if (match) {
        setSelectedPreset(match[0]);
      } else {
        setSelectedPreset(null);
      }
    }
  }, [brand]);

  // Dynamic Contrast calculation: white text on dark bg, dark text on light bg
  const isDark = isDarkColor(backgroundColor);
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748B';
  const textTertiary = isDark ? 'rgba(255, 255, 255, 0.4)' : '#94A3B8';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.14)' : '#CBD5E1';
  const backButtonBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const backButtonBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
  const primaryTextColor = getContrastColor(primaryColor);

  const activePresetName = useMemo(() => {
    if (selectedPreset && PRESET_THEMES[selectedPreset]) {
      return PRESET_THEMES[selectedPreset].name;
    }
    const match = Object.entries(PRESET_THEMES).find(
      ([_, p]) =>
        p.primary_color.toLowerCase() === primaryColor.toLowerCase() &&
        p.background_color.toLowerCase() === backgroundColor.toLowerCase()
    );
    return match ? match[1].name : 'Custom';
  }, [selectedPreset, primaryColor, backgroundColor]);

  // Restricted Access View
  if (!canManageBrand) {
    return (
      <View style={[styles.screen, { backgroundColor: currentTheme.colors.background }]}>
        <StatusBar style={currentTheme.isDarkMode ? 'light' : 'dark'} />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => safeBack('/(coach)/(tabs)/profile')}
            style={[styles.backButton, { backgroundColor: backButtonBg, borderColor: backButtonBorder }]}
          >
            <ChevronLeft size={22} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Brand</Text>
            <Text style={[styles.headerSubtitle, { color: currentTheme.colors.textSecondary }]}>View Only</Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>

        <View style={styles.restrictedContent}>
          <View style={[styles.restrictedCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ShieldAlert size={44} color={primaryColor} style={{ marginBottom: 16 }} />
            <Text style={[styles.cardTitle, { color: currentTheme.colors.text, textAlign: 'center' }]}>
              Access Restricted
            </Text>
            <Text style={[styles.helperText, { color: currentTheme.colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
              Brand settings are managed at the organization level. Contact your administrator to request updates.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to photos to choose a brand logo.');
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
      let fileExt = 'jpg';
      if (uri.startsWith('file://') || uri.startsWith('content://')) {
        const uriParts = uri.split('.');
        if (uriParts.length > 1) {
          const ext = uriParts[uriParts.length - 1].split('?')[0];
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext.toLowerCase())) {
            fileExt = ext.toLowerCase();
          }
        }
      }

      const fileName = `brand-logo-${Date.now()}.${fileExt}`;
      const filePath = `brands/${fileName}`;

      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to read image: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };

      const { error: uploadError } = await supabase.storage
        .from('meal-photos')
        .upload(filePath, arrayBuffer, {
          contentType: mimeTypes[fileExt] || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('meal-photos').getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Logo Updated', 'Your brand logo has been uploaded successfully.');
    } catch (error) {
      console.error('[Logo Upload] Error:', error);
      Alert.alert('Upload Error', 'Could not upload logo. Please try another image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectFont = (fontName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFontFamily(fontName);

    // Predict the best combination automatically based on the font family:
    // Heading: 700 Bold
    // Body: 500 Medium for Raleway, Outfit, and Montserrat so they are never hair-thin! 400 for standard fonts
    const predictedHeading = '700';
    const predictedBody =
      fontName === 'Raleway' || fontName === 'Outfit' || fontName === 'Montserrat' ? '500' : '400';
    const predictedScale = 1.0;

    setHeadingWeight(predictedHeading);
    setBodyWeight(predictedBody);
    setFontScale(predictedScale);

    (globalThis as any).currentBrandFontFamily = fontName;
    (globalThis as any).currentBrandHeadingWeight = predictedHeading;
    (globalThis as any).currentBrandBodyWeight = predictedBody;
  };

  const applyPreset = (presetKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const preset = PRESET_THEMES[presetKey];
    if (!preset) return;

    setSelectedPreset(presetKey);
    setPrimaryColor(preset.primary_color);
    setSecondaryColor(preset.secondary_color);
    setAccentColor(preset.accent_color);
    setBackgroundColor(preset.background_color);
    if (preset.font_family) {
      handleSelectFont(preset.font_family);
    }
  };

  const openColorPicker = (field: 'primary' | 'secondary' | 'accent' | 'background') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    }
    // Check if new combination matches a preset
    setSelectedPreset(null);
  };

  const handleSave = async () => {
    if (!brandName.trim()) {
      Alert.alert('Name Required', 'Please enter a brand name before saving.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        await refreshBrand();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', 'Brand settings updated successfully.');
        if (currentView !== 'overview') {
          setCurrentView('overview');
        }
      } else {
        Alert.alert('Save Failed', 'Could not update brand settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving brand:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentView === 'overview') {
      safeBack('/(coach)/(tabs)/profile');
    } else {
      setCurrentView('overview');
    }
  };

  // Header Titles based on active view
  const headerInfo = useMemo(() => {
    switch (currentView) {
      case 'identity':
        return { title: 'Identity', subtitle: 'Name & Logo' };
      case 'colors':
        return { title: 'Colors', subtitle: 'Palette & Presets' };
      case 'font':
        return { title: 'Font', subtitle: 'Typography' };
      default:
        return { title: 'Brand', subtitle: 'Overview' };
    }
  }, [currentView]);

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Header - Matches Analytics Overview Header Pattern */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: backButtonBg, borderColor: backButtonBorder }]}
        >
          <ChevronLeft size={22} color={textColor} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{headerInfo.title}</Text>
          <Text style={[styles.headerSubtitle, { color: textSecondary }]}>{headerInfo.subtitle}</Text>
        </View>

        {currentView === 'overview' ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFullPreview(true);
            }}
            style={[styles.previewButton, { backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40` }]}
          >
            <Eye size={20} color={primaryColor} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setCurrentView('overview')}
            style={styles.doneHeaderButton}
          >
            <Text style={[styles.doneHeaderText, { color: primaryColor }]}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* VIEW 1: BRAND OVERVIEW (3 CARDS) */}
        {currentView === 'overview' && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 } as any}
            style={styles.cardsStack}
          >
            {/* 1. IDENTITY CARD */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentView('identity');
              }}
              style={[styles.metricCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <View style={styles.metricCardHeader}>
                <View style={styles.metricCardTitleRow}>
                  <View style={[styles.cardIconBadge, { backgroundColor: `${primaryColor}18` }]}>
                    <LayoutGrid size={18} color={primaryColor} />
                  </View>
                  <Text style={[styles.metricCardTitle, { color: textColor }]}>Identity</Text>
                </View>
                <View style={styles.metricCardRightRow}>
                  <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                    {brandName ? 'Custom' : 'Default'}
                  </Text>
                  <ChevronRight size={18} color={textSecondary} />
                </View>
              </View>

              <View style={styles.identityCardContent}>
                <View style={[styles.avatarBox, { backgroundColor: `${primaryColor}20`, borderColor: cardBorder }]}>
                  {logoUrl ? (
                    <Image
                      source={{ uri: logoUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <Text style={[styles.avatarFallbackText, { color: primaryColor }]}>
                      {brandName ? brandName.charAt(0).toUpperCase() : 'B'}
                    </Text>
                  )}
                </View>

                <View style={styles.identityInfo}>
                  <Text style={[styles.identityName, { color: textColor }]} numberOfLines={1}>
                    {brandName || 'Untitled Brand'}
                  </Text>
                  <Text style={[styles.identityStatus, { color: textSecondary }]}>
                    {logoUrl ? 'Logo uploaded' : 'No logo uploaded'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 2. COLORS CARD (WITH PRESET CHOSEN IN OUTER CARD) */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentView('colors');
              }}
              style={[styles.metricCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <View style={styles.metricCardHeader}>
                <View style={styles.metricCardTitleRow}>
                  <View style={[styles.cardIconBadge, { backgroundColor: `${primaryColor}18` }]}>
                    <Palette size={18} color={primaryColor} />
                  </View>
                  <Text style={[styles.metricCardTitle, { color: textColor }]}>Colors</Text>
                </View>
                <View style={styles.metricCardRightRow}>
                  <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                    {activePresetName}
                  </Text>
                  <ChevronRight size={18} color={textSecondary} />
                </View>
              </View>

              <View style={styles.colorsCardContent}>
                {/* 4 Color Swatches */}
                <View style={styles.colorSwatchesRow}>
                  <View style={styles.swatchItem}>
                    <View style={[styles.colorDot, { backgroundColor: primaryColor, borderColor: cardBorder }]} />
                    <Text style={[styles.swatchLabel, { color: textSecondary }]}>Primary</Text>
                    <Text style={[styles.swatchHex, { color: textColor }]}>
                      {primaryColor.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.swatchItem}>
                    <View style={[styles.colorDot, { backgroundColor: secondaryColor, borderColor: cardBorder }]} />
                    <Text style={[styles.swatchLabel, { color: textSecondary }]}>Secondary</Text>
                    <Text style={[styles.swatchHex, { color: textColor }]}>
                      {secondaryColor.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.swatchItem}>
                    <View style={[styles.colorDot, { backgroundColor: accentColor, borderColor: cardBorder }]} />
                    <Text style={[styles.swatchLabel, { color: textSecondary }]}>Accent</Text>
                    <Text style={[styles.swatchHex, { color: textColor }]}>
                      {accentColor.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.swatchItem}>
                    <View style={[styles.colorDot, { backgroundColor, borderColor: cardBorder }]} />
                    <Text style={[styles.swatchLabel, { color: textSecondary }]}>Base</Text>
                    <Text style={[styles.swatchHex, { color: textColor }]}>
                      {backgroundColor.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Preset Badge */}
                <View style={[styles.presetBadge, { backgroundColor: `${primaryColor}16` }]}>
                  <Sparkles size={12} color={primaryColor} />
                  <Text style={[styles.presetBadgeText, { color: primaryColor }]}>
                    {activePresetName} Theme Active
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 3. FONT CARD */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentView('font');
              }}
              style={[styles.metricCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <View style={styles.metricCardHeader}>
                <View style={styles.metricCardTitleRow}>
                  <View style={[styles.cardIconBadge, { backgroundColor: `${primaryColor}18` }]}>
                    <Type size={18} color={primaryColor} />
                  </View>
                  <Text style={[styles.metricCardTitle, { color: textColor }]}>Font</Text>
                </View>
                <View style={styles.metricCardRightRow}>
                  <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                    {fontFamily || 'System'}
                  </Text>
                  <ChevronRight size={18} color={textSecondary} />
                </View>
              </View>

              <View style={styles.fontCardContent}>
                <Text
                  style={[
                    styles.fontFamilyDisplay,
                    {
                      color: textColor,
                      fontFamily: getFontFamily(fontFamily, '700'),
                      fontWeight: undefined,
                    },
                  ]}
                >
                  {fontFamily || 'System'}
                </Text>

                <Text
                  style={[
                    styles.fontSampleText,
                    {
                      color: textSecondary,
                      fontFamily: getFontFamily(fontFamily, bodyWeight || '500'),
                      fontWeight: undefined,
                    },
                  ]}
                >
                  Consistent effort creates lasting progress.
                </Text>

                <View style={[styles.presetBadge, { backgroundColor: `${primaryColor}16`, marginTop: 4 }]}>
                  <Sparkles size={12} color={primaryColor} />
                  <Text style={[styles.presetBadgeText, { color: primaryColor }]}>
                    Brand Typography Active
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </MotiView>
        )}

        {/* VIEW 2: IDENTITY ADJUSTMENT */}
        {currentView === 'identity' && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 } as any}
            style={styles.detailContainer}
          >
            {/* Brand Name Input */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.fieldTitle, { color: textColor }]}>Brand Name</Text>
              <Text style={[styles.fieldSubtitle, { color: textSecondary }]}>
                Visible across client dashboards and messages
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: inputBg,
                    borderColor: inputBorder,
                    color: textColor,
                  },
                ]}
                placeholder="e.g., Apex Fitness"
                placeholderTextColor={textTertiary}
                value={brandName}
                onChangeText={setBrandName}
              />
            </View>

            {/* Brand Logo Upload */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.fieldTitle, { color: textColor }]}>Brand Logo</Text>
              <Text style={[styles.fieldSubtitle, { color: textSecondary }]}>
                A clean, square logo gives the best result
              </Text>

              {logoUrl ? (
                <View style={styles.logoEditContainer}>
                  <View style={[styles.largeLogoBox, { backgroundColor: inputBg, borderColor: cardBorder }]}>
                    <Image source={{ uri: logoUrl }} style={styles.largeLogoImage} contentFit="contain" />
                  </View>

                  <View style={styles.logoActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={pickImage}
                      disabled={uploading}
                      style={[styles.logoActionBtn, { backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40` }]}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={primaryColor} />
                      ) : (
                        <>
                          <Upload size={16} color={primaryColor} />
                          <Text style={[styles.logoActionBtnText, { color: primaryColor }]}>Change Logo</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLogoUrl('');
                      }}
                      style={[styles.logoActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}
                    >
                      <Trash2 size={16} color="#EF4444" />
                      <Text style={[styles.logoActionBtnText, { color: '#EF4444' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={pickImage}
                  disabled={uploading}
                  style={[styles.uploadBox, { backgroundColor: inputBg, borderColor: inputBorder }]}
                >
                  {uploading ? (
                    <ActivityIndicator size="large" color={primaryColor} />
                  ) : (
                    <>
                      <View style={[styles.uploadIconCircle, { backgroundColor: `${primaryColor}18` }]}>
                        <Upload size={22} color={primaryColor} />
                      </View>
                      <Text style={[styles.uploadPromptTitle, { color: textColor }]}>Upload Logo</Text>
                      <Text style={[styles.uploadPromptSubtitle, { color: textSecondary }]}>
                        Tap to choose from photo library
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </MotiView>
        )}

        {/* VIEW 3: COLORS ADJUSTMENT (PRESETS INSIDE COLORS CARD) */}
        {currentView === 'colors' && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 } as any}
            style={styles.detailContainer}
          >
            {/* Ready-made Presets */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${primaryColor}18` }]}>
                  <Sparkles size={18} color={primaryColor} />
                </View>
                <View>
                  <Text style={[styles.fieldTitle, { color: textColor }]}>Color Presets</Text>
                  <Text style={[styles.fieldSubtitle, { color: textSecondary, marginBottom: 0 }]}>
                    Pick a ready-made palette
                  </Text>
                </View>
              </View>

              <View style={styles.presetsGrid}>
                {Object.entries(PRESET_THEMES).map(([key, preset]) => {
                  const isActive =
                    selectedPreset === key ||
                    (primaryColor.toLowerCase() === preset.primary_color.toLowerCase() &&
                      backgroundColor.toLowerCase() === preset.background_color.toLowerCase());

                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.8}
                      onPress={() => applyPreset(key)}
                      style={[
                        styles.presetCardItem,
                        {
                          backgroundColor: inputBg,
                          borderColor: isActive ? primaryColor : cardBorder,
                          borderWidth: isActive ? 2 : 1,
                        },
                      ]}
                    >
                      {isActive && (
                        <View style={[styles.presetCheckPill, { backgroundColor: primaryColor }]}>
                          <Check size={10} color={primaryTextColor} />
                        </View>
                      )}

                      <View style={styles.presetDotsWrap}>
                        <View style={[styles.presetMiniDot, { backgroundColor: preset.primary_color }]} />
                        <View style={[styles.presetMiniDot, { backgroundColor: preset.secondary_color }]} />
                        <View style={[styles.presetMiniDot, { backgroundColor: preset.background_color, borderColor: cardBorder, borderWidth: 1 }]} />
                      </View>

                      <Text style={[styles.presetCardName, { color: textColor }]} numberOfLines={1}>
                        {preset.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Individual Color Pickers */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${primaryColor}18` }]}>
                  <Palette size={18} color={primaryColor} />
                </View>
                <View>
                  <Text style={[styles.fieldTitle, { color: textColor }]}>Custom Colors</Text>
                  <Text style={[styles.fieldSubtitle, { color: textSecondary, marginBottom: 0 }]}>
                    Fine-tune individual colors
                  </Text>
                </View>
              </View>

              <View style={styles.colorPickersList}>
                <ColorRow
                  label="Primary Color"
                  sublabel="Buttons, active highlights"
                  value={primaryColor}
                  textColor={textColor}
                  textSecondary={textSecondary}
                  cardBorder={cardBorder}
                  inputBg={inputBg}
                  onPress={() => openColorPicker('primary')}
                />
                <ColorRow
                  label="Secondary Color"
                  sublabel="Supporting accents & tags"
                  value={secondaryColor}
                  textColor={textColor}
                  textSecondary={textSecondary}
                  cardBorder={cardBorder}
                  inputBg={inputBg}
                  onPress={() => openColorPicker('secondary')}
                />
                <ColorRow
                  label="Accent Color"
                  sublabel="Badges & stars"
                  value={accentColor}
                  textColor={textColor}
                  textSecondary={textSecondary}
                  cardBorder={cardBorder}
                  inputBg={inputBg}
                  onPress={() => openColorPicker('accent')}
                />
                <ColorRow
                  label="Background Color"
                  sublabel="Screen and page background"
                  value={backgroundColor}
                  textColor={textColor}
                  textSecondary={textSecondary}
                  cardBorder={cardBorder}
                  inputBg={inputBg}
                  onPress={() => openColorPicker('background')}
                />
              </View>
            </View>
          </MotiView>
        )}

        {/* VIEW 4: FONT ADJUSTMENT */}
        {currentView === 'font' && (
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 } as any}
            style={styles.detailContainer}
          >
            {/* Font Family Selection */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${primaryColor}18` }]}>
                  <Type size={18} color={primaryColor} />
                </View>
                <View>
                  <Text style={[styles.fieldTitle, { color: textColor }]}>Font Family</Text>
                  <Text style={[styles.fieldSubtitle, { color: textSecondary, marginBottom: 0 }]}>
                    App-wide typography style
                  </Text>
                </View>
              </View>

              <View style={styles.fontsList}>
                {AVAILABLE_FONTS.map((font) => {
                  const isSelected = (fontFamily || 'System') === font.name;
                  return (
                    <TouchableOpacity
                      key={font.name}
                      activeOpacity={0.7}
                      onPress={() => handleSelectFont(font.name)}
                      style={[
                        styles.fontOptionRow,
                        {
                          backgroundColor: isSelected ? `${primaryColor}16` : inputBg,
                          borderColor: isSelected ? primaryColor : cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.fontOptionInfo}>
                        <Text
                          style={[
                            styles.fontOptionName,
                            {
                              color: isSelected ? primaryColor : textColor,
                              fontFamily: getFontFamily(font.name, '700'),
                              fontWeight: undefined,
                            },
                          ]}
                        >
                          {font.name}
                        </Text>
                        <Text
                          style={[
                            styles.fontOptionPreview,
                            {
                              color: textSecondary,
                              fontFamily: getFontFamily(font.name, font.name === 'Raleway' || font.name === 'Outfit' ? '500' : '400'),
                              fontWeight: undefined,
                            },
                          ]}
                        >
                          The quick brown fox jumps over the lazy dog
                        </Text>
                      </View>

                      {isSelected && (
                        <View style={[styles.fontCheckCircle, { backgroundColor: primaryColor }]}>
                          <Check size={14} color={primaryTextColor} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Live Typography Preview Card */}
            <View style={[styles.detailCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.fieldTitle, { color: textColor }]}>Live Preview</Text>
              <Text style={[styles.fieldSubtitle, { color: textSecondary, marginBottom: 12 }]}>
                Optimal weights automatically tuned for {fontFamily || 'System'}
              </Text>
              <View style={[styles.livePreviewBox, { backgroundColor: inputBg, borderColor: cardBorder }]}>
                <Text
                  style={[
                    styles.livePreviewHeading,
                    {
                      color: textColor,
                      fontFamily: getFontFamily(fontFamily, '700'),
                      fontWeight: undefined,
                      fontSize: 22,
                    },
                  ]}
                >
                  Weekly Coaching Progress
                </Text>
                <Text
                  style={[
                    styles.livePreviewBody,
                    {
                      color: textSecondary,
                      fontFamily: getFontFamily(fontFamily, bodyWeight || '500'),
                      fontWeight: undefined,
                      fontSize: 14,
                    },
                  ]}
                >
                  Your clients will experience this typography style consistently across all workout plans, check-ins, and messages.
                </Text>
              </View>
            </View>
          </MotiView>
        )}
      </ScrollView>

      {/* Sticky Bottom Save Action Bar */}
      <View
        style={[
          styles.bottomActionBar,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)',
            borderTopColor: cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={loading}
          style={[styles.saveButton, { backgroundColor: primaryColor }, loading && { opacity: 0.7 }]}
        >
          {loading ? (
            <ActivityIndicator color={primaryTextColor} />
          ) : (
            <View style={styles.saveButtonContent}>
              <Save size={18} color={primaryTextColor} strokeWidth={2.5} />
              <Text style={[styles.saveButtonText, { color: primaryTextColor }]}>Save Changes</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Color Picker Modal */}
      <ColorPickerModal
        visible={showColorPicker}
        currentColor={
          activeColorField === 'primary'
            ? primaryColor
            : activeColorField === 'secondary'
            ? secondaryColor
            : activeColorField === 'accent'
            ? accentColor
            : backgroundColor
        }
        title={
          activeColorField === 'primary'
            ? 'Primary Color'
            : activeColorField === 'secondary'
            ? 'Secondary Color'
            : activeColorField === 'accent'
            ? 'Accent Color'
            : 'Background Color'
        }
        onClose={() => setShowColorPicker(false)}
        onColorSelected={handleColorChange}
        primaryColor={primaryColor}
        primaryTextColor={primaryTextColor}
      />

      {/* Full Simulated Preview Modal */}
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
          onClose={() => setShowFullPreview(false)}
        />
      </Modal>
    </View>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function ColorRow({
  label,
  sublabel,
  value,
  textColor,
  textSecondary,
  cardBorder,
  inputBg,
  onPress,
}: {
  label: string;
  sublabel: string;
  value: string;
  textColor: string;
  textSecondary: string;
  cardBorder: string;
  inputBg: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.colorPickerRow, { backgroundColor: inputBg, borderColor: cardBorder }]}
    >
      <View style={[styles.colorSquareSwatch, { backgroundColor: value, borderColor: cardBorder }]} />
      <View style={styles.colorRowInfo}>
        <Text style={[styles.colorRowLabel, { color: textColor }]}>{label}</Text>
        <Text style={[styles.colorRowSublabel, { color: textSecondary }]}>{sublabel}</Text>
      </View>
      <View style={styles.colorRowRight}>
        <Text style={[styles.colorRowHex, { color: textColor }]}>{value.toUpperCase()}</Text>
        <ChevronRight size={16} color={textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Wheel Color Picker Modal ────────────────────────────────────────────────
function ColorPickerModal({
  visible,
  currentColor,
  title,
  onClose,
  onColorSelected,
  primaryColor,
  primaryTextColor,
}: {
  visible: boolean;
  currentColor: string;
  title: string;
  onClose: () => void;
  onColorSelected: (color: string) => void;
  primaryColor: string;
  primaryTextColor: string;
}) {
  const [tempColor, setTempColor] = useState(currentColor);

  useEffect(() => {
    setTempColor(currentColor);
  }, [currentColor]);

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onColorSelected(tempColor);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.colorModalBox}>
          <View style={styles.colorModalHeader}>
            <Text style={styles.colorModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.wheelContainer}>
            <ColorPicker
              color={tempColor}
              onColorChange={(c: string) => setTempColor(c)}
              onColorChangeComplete={(c: string) => setTempColor(c)}
              thumbSize={28}
              sliderSize={28}
              noSnap
              row={false}
            />
          </View>

          <View style={styles.colorPreviewBar}>
            <View style={[styles.previewSwatchBox, { backgroundColor: tempColor }]} />
            <Text style={styles.previewHexCode}>{tempColor.toUpperCase()}</Text>
          </View>

          <TouchableOpacity
            style={[styles.modalConfirmBtn, { backgroundColor: primaryColor }]}
            onPress={handleConfirm}
          >
            <Text style={[styles.modalConfirmBtnText, { color: primaryTextColor }]}>Select Color</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Full App Preview Simulation ─────────────────────────────────────────────
function FullPreviewContent({
  brandName,
  logoUrl,
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor,
  fontFamily,
  headingWeight,
  onClose,
}: {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  headingWeight: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isDark = isDarkColor(backgroundColor);
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748B';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View style={[styles.fullPreviewScreen, { backgroundColor }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Floating Close Button */}
      <TouchableOpacity
        style={[styles.fullPreviewCloseBtn, { top: insets.top + 10, backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40` }]}
        onPress={onClose}
      >
        <X size={20} color={primaryColor} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: 60, paddingHorizontal: 20 }}>
        {/* Brand Header */}
        <View style={styles.fullPreviewBrandRow}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.fullPreviewLogo} contentFit="contain" />
          ) : (
            <View style={[styles.fullPreviewLogoPlaceholder, { backgroundColor: `${primaryColor}20` }]}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: primaryColor }}>
                {brandName ? brandName.charAt(0).toUpperCase() : 'B'}
              </Text>
            </View>
          )}
          <View>
            <Text
              style={[
                styles.fullPreviewBrandTitle,
                { color: textColor, fontFamily: getFontFamily(fontFamily, headingWeight) },
              ]}
            >
              {brandName || 'Coach Brand'}
            </Text>
            <Text style={[styles.fullPreviewBrandSubtitle, { color: textSecondary }]}>
              Client App Preview
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.fullPreviewStatsGrid}>
          <View style={[styles.fullPreviewStatCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.statIconCircle, { backgroundColor: `${primaryColor}16` }]}>
              <Users size={18} color={primaryColor} />
            </View>
            <Text style={[styles.fullPreviewStatVal, { color: textColor }]}>18</Text>
            <Text style={[styles.fullPreviewStatLbl, { color: textSecondary }]}>Active Clients</Text>
          </View>

          <View style={[styles.fullPreviewStatCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.statIconCircle, { backgroundColor: `${secondaryColor}16` }]}>
              <TrendingUp size={18} color={secondaryColor} />
            </View>
            <Text style={[styles.fullPreviewStatVal, { color: textColor }]}>94%</Text>
            <Text style={[styles.fullPreviewStatLbl, { color: textSecondary }]}>Check-In Rate</Text>
          </View>
        </View>

        {/* Sample Activity Card */}
        <View style={[styles.fullPreviewSampleCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.sampleCardTitle, { color: textColor }]}>Today's Workout Plan</Text>
          <Text style={[styles.sampleCardSub, { color: textSecondary }]}>Upper Body Power & Core</Text>

          <View style={[styles.sampleActionBtn, { backgroundColor: primaryColor }]}>
            <Text style={[styles.sampleActionBtnText, { color: getContrastColor(primaryColor) }]}>
              Start Workout
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Stylesheet ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerRightSpacer: {
    width: 40,
  },
  previewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  doneHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneHeaderText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  cardsStack: {
    gap: 14,
  },
  // Metric Card (Identical pattern to Analytics Overview)
  metricCard: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metricCardRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricCardTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Identity Card Content
  identityCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallbackText: {
    fontSize: 22,
    fontWeight: '900',
  },
  identityInfo: {
    flex: 1,
  },
  identityName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  identityStatus: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  // Colors Card Content
  colorsCardContent: {
    marginTop: 16,
    gap: 14,
  },
  colorSwatchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swatchItem: {
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  swatchHex: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  presetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
  },
  presetBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Font Card Content
  fontCardContent: {
    marginTop: 16,
    gap: 8,
  },
  fontFamilyDisplay: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  fontSampleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  fontMetaRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  fontMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Detail Views
  detailContainer: {
    gap: 16,
  },
  detailCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  fieldTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  fieldSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 14,
  },
  textInput: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  logoEditContainer: {
    alignItems: 'center',
    gap: 16,
  },
  largeLogoBox: {
    width: 120,
    height: 120,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeLogoImage: {
    width: '100%',
    height: '100%',
  },
  logoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  logoActionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  uploadBox: {
    height: 130,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  uploadPromptSubtitle: {
    fontSize: 12,
  },
  // Presets Grid in Colors View
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetCardItem: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    position: 'relative',
    gap: 10,
  },
  presetCheckPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetDotsWrap: {
    flexDirection: 'row',
    gap: -6,
  },
  presetMiniDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  presetCardName: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Color Pickers List
  colorPickersList: {
    gap: 10,
  },
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  colorSquareSwatch: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  colorRowInfo: {
    flex: 1,
  },
  colorRowLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  colorRowSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  colorRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorRowHex: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // Font List in Font View
  fontsList: {
    gap: 10,
  },
  fontOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  fontOptionInfo: {
    flex: 1,
  },
  fontOptionName: {
    fontSize: 16,
    fontWeight: '700',
  },
  fontOptionPreview: {
    fontSize: 12,
    marginTop: 2,
  },
  fontCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  weightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  weightPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  weightPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  livePreviewBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  livePreviewHeading: {
    letterSpacing: -0.3,
  },
  livePreviewBody: {
    lineHeight: 20,
  },
  // Bottom Action Bar
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  saveButton: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  // Restricted State
  restrictedContent: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
  },
  restrictedCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorModalBox: {
    backgroundColor: '#0F172A',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  colorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    padding: 4,
  },
  wheelContainer: {
    height: 240,
    marginBottom: 20,
  },
  colorPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 14,
    marginBottom: 20,
    gap: 12,
  },
  previewSwatchBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewHexCode: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalConfirmBtn: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  // Full Preview Screen
  fullPreviewScreen: {
    flex: 1,
  },
  fullPreviewCloseBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 50,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPreviewBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  fullPreviewLogo: {
    width: 54,
    height: 54,
    borderRadius: 18,
  },
  fullPreviewLogoPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPreviewBrandTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  fullPreviewBrandSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  fullPreviewStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  fullPreviewStatCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  fullPreviewStatVal: {
    fontSize: 24,
    fontWeight: '900',
  },
  fullPreviewStatLbl: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  fullPreviewSampleCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    gap: 10,
  },
  sampleCardTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sampleCardSub: {
    fontSize: 13,
    marginBottom: 8,
  },
  sampleActionBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
