import React from 'react';
import { View, Platform } from 'react-native';
import { useTheme } from '@/contexts/BrandContext';
import { vars } from 'nativewind';
import { installGlobalFontPatcher } from '@/lib/font-patcher';

// Ensure the global font patcher is installed
installGlobalFontPatcher();

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  // Set synchronously during render so all children in the tree get the active font immediately
  const activeFont = theme.typography.fontFamily || 'System';
  (globalThis as any).currentBrandFontFamily = activeFont;
  (globalThis as any).currentBrandHeadingWeight = theme.typography.headingWeight;
  (globalThis as any).currentBrandBodyWeight = theme.typography.bodyWeight;

  React.useEffect(() => {
    (globalThis as any).currentBrandFontFamily = activeFont;
  }, [activeFont]);

  React.useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--color-bg', theme.colors.background || '#020617');
      root.style.setProperty('--color-surface', theme.colors.surface || '#0F172A');
      root.style.setProperty('--color-border', theme.colors.border || '#1E293B');
      root.style.setProperty('--color-primary', theme.colors.primary || '#3B82F6');
      root.style.setProperty('--color-primary-text', theme.colors.primaryHover || '#60A5FA');
      root.style.setProperty('--color-text-primary', theme.colors.text || '#F1F5F9');
      root.style.setProperty('--color-text-secondary', theme.colors.textSecondary || '#94A3B8');
      root.style.setProperty('--color-text-muted', theme.colors.textTertiary || '#475569');
      root.style.setProperty('--color-accent', theme.colors.accent || '#FBBF24');
      root.style.setProperty('--color-success', theme.colors.success || '#10B981');
      root.style.setProperty('--color-error', theme.colors.error || '#EF4444');
    }
  }, [theme]);

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
    <View
      key={`theme-font-wrapper-${activeFont}`}
      style={Platform.OS === 'web' ? { flex: 1 } : [themeVars, { flex: 1 }]}
    >
      {children}
    </View>
  );
}
