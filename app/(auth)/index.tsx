import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';

export default function WelcomeScreen() {
  const { brand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const brandTitle = brand?.name?.trim() || 'Coaching';
  const brandInitial = brandTitle.charAt(0).toUpperCase();
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)';
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 px-8 justify-between pt-16 pb-12">
          {/* Centered Brand / Hero Area */}
          <View className="flex-1 justify-center items-center">
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 400 } as any}
              className="items-center"
            >
              {brand?.logo_url ? (
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 32,
                    backgroundColor: colors.surface,
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.3,
                    shadowRadius: 24,
                    elevation: 12,
                    overflow: 'hidden',
                    marginBottom: 28,
                  }}
                  className="items-center justify-center"
                >
                  <Image
                    source={{ uri: brand.logo_url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 32,
                    backgroundColor: colors.primary + '20',
                    borderWidth: 1.5,
                    borderColor: colors.primary + '40',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.3,
                    shadowRadius: 24,
                    elevation: 12,
                    marginBottom: 28,
                  }}
                  className="items-center justify-center"
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 42,
                      fontWeight: '900',
                      fontFamily: headingFont,
                    }}
                  >
                    {brandInitial}
                  </Text>
                </View>
              )}

              <Text
                style={{
                  color: colors.text,
                  fontFamily: headingFont,
                }}
                className="text-4xl font-black text-center tracking-tight leading-tight px-4"
              >
                {brandTitle}
              </Text>

              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: bodyFont,
                }}
                className="text-base font-semibold text-center mt-3 tracking-wide"
              >
                Your coaching, elevated.
              </Text>
            </MotiView>
          </View>

          {/* Bottom Action Buttons (Spotify Style) */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 150 } as any}
            className="w-full gap-4"
          >
            {/* Primary: Sign up for free */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.primary,
                borderBottomWidth: 4,
                borderBottomColor: colors.primaryPressed,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
                borderRadius: 32,
              }}
              className="h-16 items-center justify-center"
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text
                style={{
                  color: colors.textOnPrimary,
                  fontFamily: headingFont,
                }}
                className="font-black text-lg tracking-wide uppercase"
              >
                Sign up for free
              </Text>
            </TouchableOpacity>

            {/* Secondary: Log in */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                backgroundColor: surfaceBg,
                borderColor: inputBorder,
                borderWidth: 1.5,
                borderRadius: 32,
              }}
              className="h-16 items-center justify-center"
              onPress={() => router.push('/(auth)/login')}
            >
              <Text
                style={{
                  color: colors.text,
                  fontFamily: headingFont,
                }}
                className="font-black text-lg tracking-wide uppercase"
              >
                Log in
              </Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </SafeAreaView>
    </View>
  );
}
