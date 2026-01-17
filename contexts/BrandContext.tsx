import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import {
  hexToRGB,
  generateHoverColor,
  generatePressedColor,
  generateDisabledColor,
  generateDarkTheme,
  getShadowStyle,
  getBorderRadiusFromShape,
  generateTypographySizes,
  getContrastColor,
  ensureValidColor,
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
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  primaryDisabled: string;
  secondary: string;
  secondaryHover: string;
  secondaryPressed: string;
  accent: string;
  accentHover: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textDisabled: string;
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
  refreshBrand: () => Promise<void>;
  updateBrandSettings: (updates: Partial<Brand>) => Promise<boolean>;
  canManageBrand: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

// ============================================================================
// THEME GENERATION FUNCTIONS
// ============================================================================

function generateThemeColors(brand: Brand | null, isDark: boolean): ThemeColors {
  // Use brand colors or defaults
  const primaryColor = ensureValidColor(brand?.primary_color, '#3B82F6');
  const secondaryColor = ensureValidColor(brand?.secondary_color, '#10B981');
  const accentColor = ensureValidColor(brand?.accent_color, '#F59E0B');
  const backgroundColor = ensureValidColor(brand?.background_color, '#F9FAFB');
  
  // If dark mode is enabled and we have dark colors, use them
  let finalPrimary = primaryColor;
  let finalSecondary = secondaryColor;
  let finalAccent = accentColor;
  let finalBackground = backgroundColor;
  
  if (isDark) {
    if (brand?.dark_mode_enabled) {
      // Use custom dark colors if provided, otherwise auto-generate
      if (brand.dark_primary_color || brand.dark_secondary_color) {
        const darkTheme = generateDarkTheme({
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor,
          background: backgroundColor,
        });
        
        finalPrimary = ensureValidColor(brand.dark_primary_color, darkTheme.primary);
        finalSecondary = ensureValidColor(brand.dark_secondary_color, darkTheme.secondary);
        finalAccent = ensureValidColor(brand.dark_accent_color, darkTheme.accent);
        finalBackground = ensureValidColor(brand.dark_background_color, darkTheme.background);
      } else {
        // Auto-generate entire dark theme
        const darkTheme = generateDarkTheme({
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor,
          background: backgroundColor,
        });
        
        finalPrimary = darkTheme.primary;
        finalSecondary = darkTheme.secondary;
        finalAccent = darkTheme.accent;
        finalBackground = darkTheme.background;
      }
    } else {
      // Dark mode not enabled for this brand, use light colors
      isDark = false;
    }
  }
  
  return {
    primary: finalPrimary,
    primaryHover: generateHoverColor(finalPrimary, isDark),
    primaryPressed: generatePressedColor(finalPrimary, isDark),
    primaryDisabled: generateDisabledColor(finalPrimary),
    secondary: finalSecondary,
    secondaryHover: generateHoverColor(finalSecondary, isDark),
    secondaryPressed: generatePressedColor(finalSecondary, isDark),
    accent: finalAccent,
    accentHover: generateHoverColor(finalAccent, isDark),
    background: finalBackground,
    surface: isDark ? '#1F2937' : '#FFFFFF',
    surfaceAlt: isDark ? '#374151' : '#F3F4F6',
    border: isDark ? '#4B5563' : '#E5E7EB',
    text: isDark ? '#F9FAFB' : '#111827',
    textSecondary: isDark ? '#D1D5DB' : '#6B7280',
    textDisabled: isDark ? '#9CA3AF' : '#D1D5DB',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
  };
}

function generateTheme(brand: Brand | null, isDark: boolean): Theme {
  const colors = generateThemeColors(brand, isDark);
  
  const typography: ThemeTypography = {
    fontFamily: brand?.font_family || 'System',
    headingWeight: brand?.heading_font_weight || '700',
    bodyWeight: brand?.body_font_weight || '400',
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
  const { coach } = useAuth();
  const systemColorScheme = useColorScheme();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManageBrand, setCanManageBrand] = useState(false);
  const [userDarkModePreference, setUserDarkModePreference] = useState<boolean | null>(null);

  // Determine if dark mode should be active
  const isDarkMode = (() => {
    // If brand doesn't support dark mode, always use light
    if (!brand?.dark_mode_enabled) return false;
    
    // If user has explicit preference, use it
    if (userDarkModePreference !== null) return userDarkModePreference;
    
    // Otherwise, follow system preference
    return systemColorScheme === 'dark';
  })();

  // Generate theme based on brand and dark mode
  const theme = generateTheme(brand, isDarkMode);

  // Load brand data
  const loadBrand = async () => {
    if (!coach?.brand_id) {
      setLoading(false);
      return;
    }

    try {
      console.log('[BrandContext] Loading brand:', coach.brand_id);
      
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', coach.brand_id)
        .single();

      if (error) {
        console.error('[BrandContext] Error loading brand:', error);
        throw error;
      }

      console.log('[BrandContext] Brand loaded:', data);
      setBrand(data);
      setCanManageBrand(coach.can_manage_brand || false);
    } catch (error) {
      console.error('[BrandContext] Failed to load brand:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh brand (exposed to components)
  const refreshBrand = async () => {
    setLoading(true);
    await loadBrand();
  };

  // Update brand settings
  const updateBrandSettings = async (updates: Partial<Brand>): Promise<boolean> => {
    if (!brand || !canManageBrand) {
      console.error('[BrandContext] Cannot update brand - no permission');
      return false;
    }

    try {
      console.log('[BrandContext] Updating brand:', updates);
      
      const { data, error } = await supabase.rpc('update_brand', {
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
        throw error;
      }

      console.log('[BrandContext] Brand updated successfully');
      
      // Refresh brand data
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

  // Load brand when coach changes
  useEffect(() => {
    if (coach) {
      loadBrand();
    } else {
      setBrand(null);
      setLoading(false);
    }
  }, [coach?.brand_id]);

  return (
    <BrandContext.Provider
      value={{
        brand,
        theme,
        loading,
        refreshBrand,
        updateBrandSettings,
        canManageBrand,
        isDarkMode,
        toggleDarkMode,
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
