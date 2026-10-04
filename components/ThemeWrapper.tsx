import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { vars } from 'nativewind';
import { getFontFamily } from '@/hooks/useAppFonts';
import { Text as RNText, StyleSheet } from 'react-native';

const oldTextRender = (RNText as any).render;
if (oldTextRender && !(RNText as any).render.__patched) {
  (RNText as any).render = function render(props: any, ref: any) {
    const origin = oldTextRender.call(this, props, ref);
    if (!origin) return origin;

    let weight = '400';
    if (props.style) {
      const flat = StyleSheet.flatten(props.style) || {};
      if (flat.fontWeight) weight = String(flat.fontWeight);
    }
    
    const currentBrandFont = (global as any).currentBrandFontFamily || 'System';
    const fontFam = getFontFamily(currentBrandFont, weight);

    return React.cloneElement(origin, {
      style: [{ fontFamily: fontFam }, origin.props.style],
    });
  };
  (RNText as any).render.__patched = true;
}

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  React.useEffect(() => {
    (global as any).currentBrandFontFamily = theme.typography.fontFamily;
  }, [theme.typography.fontFamily]);

  const themeVars = vars({
    '--color-bg': theme.colors.background || '#020617',
    '--color-surface': theme.colors.surface || '#0F172A',
    '--color-border': theme.colors.border || '#1E293B',
    '--color-primary': theme.colors.primary || '#3B82F6',
    '--color-primary-text': theme.colors.primaryHover || '#60A5FA',
    '--color-text-primary': theme.colors.text || '#F1F5F9',
    '--color-text-secondary': theme.colors.textSecondary || '#94A3B8',
    '--color-text-muted': theme.colors.textTertiary || '#475569',
    '--color-accent': theme.colors.accent || '#FBBF24',
    '--color-success': theme.colors.success || '#10B981',
    '--color-error': theme.colors.error || '#EF4444',
  });

  return (
    <View style={[themeVars, { flex: 1 }]}>
      {children}
    </View>
  );
}
