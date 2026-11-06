import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useEffect } from 'react';
import { Image } from 'expo-image';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { ChevronLeft, Award, User } from 'lucide-react-native';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GradientASCII from '@/components/GradientASCII';

export default function SignUpRoleSelectionScreen() {
  const { brand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { invite: inviteParam } = useLocalSearchParams<{ invite?: string }>();

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)';
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)';
  const brandTitle = brand?.name?.trim() || '';
  const brandInitial = (brandTitle || 'C').charAt(0).toUpperCase();

  // If a user landed directly via an invite link, route them directly
  useEffect(() => {
    if (inviteParam) {
      if (inviteParam.length > 20) {
        router.replace({ pathname: '/(auth)/signup-coach', params: { invite: inviteParam } });
      } else {
        router.replace({ pathname: '/(auth)/signup-client', params: { invite: inviteParam } });
      }
    }
  }, [inviteParam]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <GradientASCII shape="horizon" glow={0.35} flow={0.6} speed={0.8} />
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 px-8 pt-6 pb-10 justify-between">
          {/* Top Row: Back Button + Brand Identity */}
          <View>
            <View className="flex-row items-center justify-between mb-8">
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  backgroundColor: surfaceBg,
                  borderColor: inputBorder,
                  borderWidth: 1,
                }}
                className="w-12 h-12 rounded-2xl items-center justify-center"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ChevronLeft size={22} color={colors.text} />
              </TouchableOpacity>

              <View className="flex-row items-center gap-3">
                {brandTitle ? (
                  <Text
                    style={{ color: colors.text, fontFamily: headingFont }}
                    className="text-base font-black tracking-tight"
                    numberOfLines={1}
                  >
                    {brandTitle}
                  </Text>
                ) : null}
                {brand?.logo_url ? (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: inputBorder,
                      overflow: 'hidden',
                    }}
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
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.primary + '20',
                      borderWidth: 1,
                      borderColor: colors.primary + '40',
                    }}
                    className="items-center justify-center"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: headingFont,
                      }}
                      className="text-lg font-black"
                    >
                      {brandInitial}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Title Header */}
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              className="mb-4"
            >
              <Text
                style={{ color: colors.text, fontFamily: headingFont }}
                className="text-4xl font-black tracking-tight uppercase"
              >
                Create{' '}
                <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                  Account
                </Text>
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                className="text-xs font-bold uppercase tracking-[4px] mt-2"
              >
                Choose your role to get started
              </Text>
            </MotiView>
          </View>

          {/* Centered Area: Question + Two Squared Buttons */}
          <MotiView
            from={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 350 } as any}
            className="my-auto py-6"
          >
            <Text
              style={{ color: colors.text, fontFamily: headingFont }}
              className="text-2xl font-black text-center mb-6 tracking-tight"
            >
              Are you a coach or a client?
            </Text>

            <View className="flex-row gap-4">
              {/* Coach Squared Card Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/(auth)/signup-coach')}
                style={{
                  backgroundColor: surfaceBg,
                  borderColor: inputBorder,
                  borderWidth: 1.5,
                  borderRadius: 28,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 4,
                }}
                className="flex-1 aspect-square p-5 items-center justify-center"
              >
                <View
                  style={{ backgroundColor: colors.primary + '18' }}
                  className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                >
                  <Award size={32} color={colors.primary} />
                </View>
                <Text
                  style={{ color: colors.text, fontFamily: headingFont }}
                  className="text-xl font-black tracking-tight text-center"
                >
                  Coach
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-semibold text-center mt-1"
                >
                  Lead & train
                </Text>
              </TouchableOpacity>

              {/* Client Squared Card Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/(auth)/signup-client')}
                style={{
                  backgroundColor: surfaceBg,
                  borderColor: inputBorder,
                  borderWidth: 1.5,
                  borderRadius: 28,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 4,
                }}
                className="flex-1 aspect-square p-5 items-center justify-center"
              >
                <View
                  style={{ backgroundColor: colors.primary + '18' }}
                  className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                >
                  <User size={32} color={colors.primary} />
                </View>
                <Text
                  style={{ color: colors.text, fontFamily: headingFont }}
                  className="text-xl font-black tracking-tight text-center"
                >
                  Client
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-semibold text-center mt-1"
                >
                  Join my coach
                </Text>
              </TouchableOpacity>
            </View>
          </MotiView>

          {/* Bottom: Log in Link */}
          <View className="items-center">
            <TouchableOpacity
              onPress={() => router.push('/(auth)/login')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: bodyFont,
                }}
                className="font-bold text-xs uppercase tracking-widest"
              >
                Already have an account?{' '}
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: headingFont,
                  }}
                >
                  Log in
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
