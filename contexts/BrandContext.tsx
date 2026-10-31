import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getFontFamily } from '@/hooks/useAppFonts';

const BRAND_CACHE_KEY = '@cached_brand_settings';
const BRAND_CAN_MANAGE_KEY = '@cached_can_manage_brand';

let memoryCachedBrand: Brand | null = null;
let memoryCachedCanManage = false;
let memoryCacheHydrated = false;
import {
  hexToRGB,
  lightenColor,
  darkenColor,
  getContrastRatio,
  getContrastColor,
  generateHoverColor,
  generatePressedColor,
  generateDisabledColor,
  generateDarkTheme,
  getShadowStyle,
  getBorderRadiusFromShape,
  scaleBorderRadius,
  scaleSpacing,
  generateTypographySizes,
  ensureValidColor,
  isDarkColor,
  generateSurfaceColors,
  generateTextColors,
} from '@/lib/theme-utils';

// ============================================================================
// BRAND INTERFACE (Extended with all theming properties)
// ============================================================================

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  
  // Colors
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  
  // Typography
  font_family: string;
  heading_font_weight: string;
  body_font_weight: string;
  font_scale: number;
  
  // Button Styling
  button_shape: 'rounded' | 'pill' | 'square';
  button_style: 'flat' | 'gradient' | 'outlined';
  button_shadow_enabled: boolean;
  
  // Spacing & Elevation
  spacing_scale: number;
  card_shadow: 'none' | 'small' | 'medium' | 'large';
  border_radius_scale: number;
  
  // Dark Mode
  dark_mode_enabled: boolean;
  dark_primary_color: string | null;
  dark_secondary_color: string | null;
  dark_accent_color: string | null;
  dark_background_color: string | null;
  
  created_at: string;
  updated_at: string;
}

// ============================================================================
// THEME INTERFACES
// ============================================================================

export interface ThemeColors {
  // Brand colors
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  primaryDisabled: string;
  secondary: string;
  secondaryHover: string;
  secondaryPressed: string;
  accent: string;
  accentHover: string;
  
  // Background and surfaces (NEW: auto-generated)
  background: string;
  surface: string;           // Cards, modals, headers
  surfaceHover: string;      // Interactive card hover state
  surfacePressed: string;    // Interactive card pressed state
  surfaceAlt: string;        // Alternate surface (kept for compatibility)
  border: string;            // Borders and dividers
  inputBackground: string;   // Search and text input backgrounds
  
  // Text colors (NEW: auto-contrast)
  text: string;              // Primary text
  textSecondary: string;     // Secondary text
  textTertiary: string;      // Tertiary text (placeholders)
  textOnSurface: string;     // Text on cards/surfaces
  textOnPrimary: string;     // Text on primary color backgrounds
  textOnSecondary: string;   // Text on secondary color backgrounds
  textDisabled: string;      // Disabled text
  
  // Semantic colors
  error: string;
  success: string;
  warning: string;
}

export interface ThemeTypography {
  fontFamily: string;
  headingWeight: string;
  bodyWeight: string;
  scale: number;
  sizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    xxl: number;
  };
}

export interface ThemeButton {
  shape: 'rounded' | 'pill' | 'square';
  style: 'flat' | 'gradient' | 'outlined';
  shadowEnabled: boolean;
  borderRadius: number;
}

export interface ThemeSpacing {
  scale: number;
  unit: number;
  cardShadow: object;
  borderRadiusScale: number;
}

export interface Theme {
  colors: ThemeColors;
  typography: ThemeTypography;
  button: ThemeButton;
  spacing: ThemeSpacing;
  isDarkMode: boolean;
}

// ============================================================================
// BRAND CONTEXT
// ============================================================================

interface BrandContextType {
  brand: Brand | null;
  theme: Theme;
  loading: boolean;
  isCacheHydrated: boolean;
  refreshBrand: () => Promise<void>;
  loadBrandById: (brandId: string, coachId?: string) => Promise<void>;
  updateBrandSettings: (updates: Partial<Brand>) => Promise<boolean>;
  canManageBrand: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  showBrandSavedModal: boolean;
  setShowBrandSavedModal: (show: boolean) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

// ============================================================================
// THEME GENERATION FUNCTIONS
// ============================================================================

function isGreenColor(hex?: string | null): boolean {
  if (!hex) return false;
  const h = hex.toLowerCase().trim();
  return (
    h === '#10b981' ||
    h === '#059669' ||
    h === '#047857' ||
    h === '#34d399' ||
    h === '#16a34a' ||
    h === '#22c55e' ||
    h === '#14b8a6' ||
    h.startsWith('#059') ||
    h.startsWith('#10b') ||
    h.startsWith('#34d')
  );
}

function generateThemeColors(brand: Brand | null, isDark: boolean): ThemeColors {
  // Use brand colors EXACTLY as the coach configured them - no modifications
  const primaryColor = ensureValidColor(brand?.primary_color, '#7FA7FF');
  const rawSecondary = brand?.secondary_color;
  const isPrimaryGreen = isGreenColor(primaryColor);
  const defaultSecondary = isPrimaryGreen ? '#10B981' : primaryColor;
  const secondaryColor = ensureValidColor(
    rawSecondary && (!isGreenColor(rawSecondary) || isPrimaryGreen)
      ? rawSecondary
      : defaultSecondary,
    defaultSecondary,
  );
  const accentColor = ensureValidColor(brand?.accent_color, '#F59E0B');
  const backgroundColor = ensureValidColor(brand?.background_color, '#010417');
  
  // Use the configured colors directly - NO dark mode overrides
  const finalPrimary = primaryColor;
  const finalSecondary = secondaryColor;
  const finalAccent = accentColor;
  const finalBackground = backgroundColor;
  
  // Auto-detect if background is dark to ensure proper text contrast
  const backgroundIsDark = isDarkColor(finalBackground);
  
  // Generate surface colors using actual background brightness
  const surfaceColors = generateSurfaceColors(finalBackground, backgroundIsDark);
  
  // Generate text colors using actual background brightness
  const textColors = generateTextColors(finalBackground, surfaceColors.surface);
  
  return {
    // Brand colors
    primary: finalPrimary,
    primaryHover: generateHoverColor(finalPrimary, isDark),
    primaryPressed: generatePressedColor(finalPrimary, isDark),
    primaryDisabled: generateDisabledColor(finalPrimary),
    secondary: finalSecondary,
    secondaryHover: generateHoverColor(finalSecondary, isDark),
    secondaryPressed: generatePressedColor(finalSecondary, isDark),
    accent: finalAccent,
    accentHover: generateHoverColor(finalAccent, isDark),
    
    // Background and surfaces (auto-generated from background color)
    background: finalBackground,
    surface: surfaceColors.surface,
    surfaceHover: surfaceColors.surfaceHover,
    surfacePressed: surfaceColors.surfacePressed,
    surfaceAlt: isDark ? lightenColor(finalBackground, 0.12) : '#F3F4F6', // Kept for compatibility
    border: surfaceColors.border,
    inputBackground: surfaceColors.inputBackground,
    
    // Text colors (auto-generated for perfect contrast)
    text: textColors.text,
    textSecondary: textColors.textSecondary,
    textTertiary: textColors.textTertiary,
    textOnSurface: textColors.textOnSurface,
    textOnPrimary: getContrastColor(finalPrimary),
    textOnSecondary: getContrastColor(finalSecondary),
    textDisabled: isDark ? '#9CA3AF' : '#D1D5DB',
    
    // Semantic colors
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
  };
}

function generateTheme(brand: Brand | null, isDark: boolean): Theme {
  const colors = generateThemeColors(brand, isDark);
  
  const fontDisplayName = brand?.font_family || 'System';
  const headingWeight = brand?.heading_font_weight || '700';
  const bodyWeight = brand?.body_font_weight || '400';
  
  const typography: ThemeTypography = {
    fontFamily: fontDisplayName,
    headingWeight,
    bodyWeight,
    scale: brand?.font_scale || 1.0,
    sizes: generateTypographySizes(brand?.font_scale || 1.0),
  };
  
  const button: ThemeButton = {
    shape: brand?.button_shape || 'rounded',
    style: brand?.button_style || 'flat',
    shadowEnabled: brand?.button_shadow_enabled || false,
    borderRadius: getBorderRadiusFromShape(brand?.button_shape || 'rounded'),
  };
  
  const spacing: ThemeSpacing = {
    scale: brand?.spacing_scale || 1.0,
    unit: 16 * (brand?.spacing_scale || 1.0),
    cardShadow: getShadowStyle(brand?.card_shadow || 'medium'),
    borderRadiusScale: brand?.border_radius_scale || 1.0,
  };
  
  return {
    colors,
    typography,
    button,
    spacing,
    isDarkMode: isDark,
  };
}

// ============================================================================
// BRAND PROVIDER
// ============================================================================

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { coach, client } = useAuth();
  const systemColorScheme = useColorScheme();
  const [brand, setBrand] = useState<Brand | null>(memoryCachedBrand);
  const [loading, setLoading] = useState(!memoryCachedBrand);
  const [isCacheHydrated, setIsCacheHydrated] = useState(memoryCacheHydrated);
  const [canManageBrand, setCanManageBrand] = useState(memoryCachedCanManage);
  const [userDarkModePreference, setUserDarkModePreference] = useState<boolean | null>(null);
  const [showBrandSavedModal, setShowBrandSavedModal] = useState(false);

  const persistBrandToCache = useCallback(async (brandData: Brand, canManage?: boolean) => {
    memoryCachedBrand = brandData;
    setBrand(brandData);

    if (brandData.logo_url) {
      Image.prefetch(brandData.logo_url).catch(() => {});
    }

    try {
      await AsyncStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(brandData));
      if (canManage !== undefined) {
        memoryCachedCanManage = canManage;
        setCanManageBrand(canManage);
        await AsyncStorage.setItem(BRAND_CAN_MANAGE_KEY, String(canManage));
      }
    } catch (err) {
      console.error('[BrandContext] Failed to persist brand cache:', err);
    }
  }, []);

  // Hydrate cached brand from local device storage immediately on startup
  useEffect(() => {
    let mounted = true;

    const hydrateFromCache = async () => {
      try {
        const [[, cachedBrandStr], [, cachedCanManageStr]] = await AsyncStorage.multiGet([
          BRAND_CACHE_KEY,
          BRAND_CAN_MANAGE_KEY,
        ]);

        if (cachedBrandStr) {
          const parsedBrand: Brand = JSON.parse(cachedBrandStr);
          memoryCachedBrand = parsedBrand;
          if (mounted) {
            setBrand(parsedBrand);
            setLoading(false);
          }
          if (parsedBrand.logo_url) {
            Image.prefetch(parsedBrand.logo_url).catch(() => {});
          }
        } else {
          // Fallback: if no brand cached yet on this device, check if a brand exists in DB
          const { data: fallbackBrand } = await supabase
            .from('brands')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackBrand && mounted) {
            await persistBrandToCache(fallbackBrand, false);
          }
        }

        if (cachedCanManageStr !== null) {
          const canManage = cachedCanManageStr === 'true';
          memoryCachedCanManage = canManage;
          if (mounted) {
            setCanManageBrand(canManage);
          }
        }
      } catch (err) {
        console.error('[BrandContext] Error hydrating brand cache:', err);
      } finally {
        memoryCacheHydrated = true;
        if (mounted) {
          setIsCacheHydrated(true);
        }
      }
    };

    hydrateFromCache();
    return () => {
      mounted = false;
    };
  }, [persistBrandToCache]);

  // Detect if the brand's background is dark to set the overall theme mode
  const isDarkMode = brand ? isDarkColor(brand.background_color) : true;

  // Generate theme based on brand and detected mode
  const theme = generateTheme(brand, isDarkMode);

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).currentBrandFontFamily = theme.typography.fontFamily || 'System';
  }

  // Load a specific brand by ID (e.g. from invite code validation on sign up)
  const loadBrandById = useCallback(async (targetBrandId: string, fallbackCoachId?: string) => {
    try {
      let resolvedBrandId = targetBrandId;
      if (!resolvedBrandId && fallbackCoachId) {
        const { data: cData } = await supabase
          .from('coaches')
          .select('brand_id')
          .eq('id', fallbackCoachId)
          .maybeSingle();
        if (cData?.brand_id) {
          resolvedBrandId = cData.brand_id;
        }
      }
      if (!resolvedBrandId) return;

      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', resolvedBrandId)
        .maybeSingle();

      if (!error && data) {
        await persistBrandToCache(data, false);
      }
    } catch (err) {
      console.error('[BrandContext] Error in loadBrandById:', err);
    }
  }, [persistBrandToCache]);

  // Load brand data
  const loadBrand = useCallback(async () => {
    try {
      const expectedBrandId = coach?.brand_id || (client as any)?.brand_id || null;
      if (!memoryCachedBrand || (expectedBrandId && memoryCachedBrand.id !== expectedBrandId)) {
        setLoading(true);
      }

      let brandId: string | null = null;
      let canManage = false;
      
      // COACH: Load their own brand
      if (coach?.brand_id) {
        brandId = coach.brand_id;
        canManage = coach.can_manage_brand || false;
        setCanManageBrand(canManage);
      } 
      // CLIENT: Load their main coach's brand
      else if (client) {
        setCanManageBrand(false);
        const directClientBrandId = (client as any).brand_id;
        if (directClientBrandId) {
          brandId = directClientBrandId;
        } else {
          // 1. Get the active coach link
          const { data: linkData, error: linkError } = await supabase
            .from('coach_client_links')
            .select('coach_id')
            .eq('client_id', client.id)
            .in('status', ['active', 'pending'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (linkError) {
            console.error('[BrandContext] Error fetching coach link:', linkError);
          } else if (linkData?.coach_id) {
            // 2. Fetch the coach's brand_id
            const { data: coachData, error: coachError } = await supabase
              .from('coaches')
              .select('brand_id')
              .eq('id', linkData.coach_id)
              .maybeSingle();

            if (coachError) {
              console.error('[BrandContext] Error fetching coach brand:', coachError);
            } else if (coachData?.brand_id) {
              brandId = coachData.brand_id;
            }
          }
        }
      }

      if (!brandId) {
        // Keep cached brand on local device (e.g. when signed out on login/signup screen)
        setCanManageBrand(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (error) {
        console.error('[BrandContext] Error loading brand:', error);
        throw error;
      }

      const mergedBrand: Brand = {
        ...data,
        name: data.name || coach?.business_name || data.name,
        logo_url: data.logo_url || coach?.logo_url || null,
      };

      await persistBrandToCache(mergedBrand, canManage);
    } catch (error) {
      console.error('[BrandContext] Failed to load brand:', error);
    } finally {
      setLoading(false);
    }
  }, [coach?.brand_id, coach?.can_manage_brand, coach?.business_name, coach?.logo_url, client?.id, persistBrandToCache]);

  // Refresh brand (exposed to components)
  const refreshBrand = useCallback(async () => {
    await loadBrand();
  }, [loadBrand]);

  // Update brand settings
  const updateBrandSettings = async (updates: Partial<Brand>): Promise<boolean> => {
    if (!brand || !canManageBrand) {
      console.error('[BrandContext] Cannot update brand - no permission');
      return false;
    }

    const previousBrand = brand;
    const optimisticBrand: Brand = {
      ...brand,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Optimistically save to state & local device cache immediately
    await persistBrandToCache(optimisticBrand, canManageBrand);

    try {
      const { error } = await supabase.rpc('update_brand', {
        p_brand_id: brand.id,
        p_name: updates.name || null,
        p_logo_url: updates.logo_url || null,
        p_primary_color: updates.primary_color || null,
        p_secondary_color: updates.secondary_color || null,
        p_accent_color: updates.accent_color || null,
        p_background_color: updates.background_color || null,
        p_font_family: updates.font_family || null,
        p_heading_font_weight: updates.heading_font_weight || null,
        p_body_font_weight: updates.body_font_weight || null,
        p_font_scale: updates.font_scale !== undefined ? updates.font_scale : null,
        p_button_shape: updates.button_shape || null,
        p_button_style: updates.button_style || null,
        p_button_shadow_enabled: updates.button_shadow_enabled !== undefined ? updates.button_shadow_enabled : null,
        p_spacing_scale: updates.spacing_scale !== undefined ? updates.spacing_scale : null,
        p_card_shadow: updates.card_shadow || null,
        p_border_radius_scale: updates.border_radius_scale !== undefined ? updates.border_radius_scale : null,
        p_dark_mode_enabled: updates.dark_mode_enabled !== undefined ? updates.dark_mode_enabled : null,
        p_dark_primary_color: updates.dark_primary_color || null,
        p_dark_secondary_color: updates.dark_secondary_color || null,
        p_dark_accent_color: updates.dark_accent_color || null,
        p_dark_background_color: updates.dark_background_color || null,
      });

      if (error) {
        console.error('[BrandContext] Error updating brand:', error);
        await persistBrandToCache(previousBrand, canManageBrand);
        throw error;
      }

      // Refresh brand data from DB and update cache
      await refreshBrand();
      return true;
    } catch (error) {
      console.error('[BrandContext] Failed to update brand:', error);
      return false;
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setUserDarkModePreference(prev => {
      if (prev === null) {
        // If no preference set, toggle opposite of system
        return systemColorScheme !== 'dark';
      }
      return !prev;
    });
  };

  // Load brand when coach or client changes
  useEffect(() => {
    loadBrand();
  }, [loadBrand]);

  return (
    <BrandContext.Provider
      value={{
        brand,
        theme,
        loading,
        isCacheHydrated,
        refreshBrand,
        loadBrandById,
        updateBrandSettings,
        canManageBrand,
        isDarkMode,
        toggleDarkMode,
        showBrandSavedModal,
        setShowBrandSavedModal,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}

export function useTheme(): Theme {
  const { theme } = useBrand();
  return theme;
}

export function useBrandColors() {
  const { theme } = useBrand();
  return theme.colors;
}

export function useBrandTypography() {
  const { theme } = useBrand();
  return theme.typography;
}

export function useBrandButton() {
  const { theme } = useBrand();
  return theme.button;
}

export function useBrandSpacing() {
  const { theme } = useBrand();
  return theme.spacing;
}
