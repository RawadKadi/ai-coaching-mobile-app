import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState } from 'react';
import { Image } from 'expo-image';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { ChevronLeft, Mail, AlertCircle } from 'lucide-react-native';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GoogleIcon from '@/components/GoogleIcon';
import { signUpCoachWithGoogle } from '@/lib/google-auth';
import GradientASCII from '@/components/GradientASCII';

export default function SignUpCoachScreen() {
  const { brand, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.1)';
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)';
  const brandTitle = brand?.name?.trim() || '';
  const brandInitial = (brandTitle || 'C').charAt(0).toUpperCase();

  const handleGoogleCoachSignUp = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await signUpCoachWithGoogle();
      if (res.success) {
        await refreshBrand();
        router.replace('/');
      } else if (res.error && res.error !== 'Authentication was cancelled') {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign up failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <GradientASCII shape="horizon" glow={0.45} flow={0.6} speed={0.8} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-8 pt-6 pb-10 justify-between">
              {/* Top Navigation Row */}
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

                {/* Header Title with multi-colored text */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 50 } as any}
                  className="mb-8"
                >
                  <Text
                    style={{ color: colors.text, fontFamily: headingFont }}
                    className="text-4xl font-black tracking-tight uppercase"
                  >
                    CREATE{' '}
                    <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                      ACCOUNT
                    </Text>
                  </Text>
                  <Text
                    style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                    className="text-xs font-bold uppercase tracking-[4px] mt-2"
                  >
                    Join to get started
                  </Text>
                </MotiView>
              </View>

              {/* Error Alert */}
              <AnimatePresence>
                {error ? (
                  <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      backgroundColor: colors.error + '15',
                      borderColor: colors.error + '35',
                    }}
                    className="border rounded-2xl p-4 mb-6 flex-row items-center gap-3"
                  >
                    <AlertCircle size={18} color={colors.error} />
                    <Text
                      style={{ color: colors.error, fontFamily: bodyFont }}
                      className="text-xs font-bold flex-1"
                    >
                      {error}
                    </Text>
                  </MotiView>
                ) : null}
              </AnimatePresence>

              {/* Bottom Interactive Area (Buttons stay below as requested) */}
              <View className="w-full">
                <View className="gap-4">
                  {/* Sign up with Google */}
                  <MotiView
                    from={{ opacity: 0, translateY: 24 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400, delay: 100 } as any}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: surfaceBg,
                        borderColor: inputBorder,
                        borderWidth: 1.5,
                        borderRadius: 32,
                      }}
                      className="h-16 items-center justify-center flex-row gap-3"
                      onPress={handleGoogleCoachSignUp}
                      disabled={googleLoading}
                    >
                      {googleLoading ? (
                        <ActivityIndicator color={colors.text} />
                      ) : (
                        <>
                          <GoogleIcon size={22} />
                          <Text
                            style={{
                              color: colors.text,
                              fontFamily: headingFont,
                            }}
                            className="font-black text-base tracking-wide"
                          >
                            Sign up with Google
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </MotiView>

                  {/* Sign up with Email -> Routes to signup-name */}
                  <MotiView
                    from={{ opacity: 0, translateY: 24 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400, delay: 180 } as any}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: surfaceBg,
                        borderColor: inputBorder,
                        borderWidth: 1.5,
                        borderRadius: 32,
                      }}
                      className="h-16 items-center justify-center flex-row gap-3"
                      onPress={() => router.push('/(auth)/signup-name')}
                      disabled={googleLoading}
                    >
                      <Mail size={22} color={colors.text} />
                      <Text
                        style={{
                          color: colors.text,
                          fontFamily: headingFont,
                        }}
                        className="font-black text-base tracking-wide"
                      >
                        Sign up with Email
                      </Text>
                    </TouchableOpacity>
                  </MotiView>
                </View>

                {/* Bottom: Log in Link */}
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 240 } as any}
                  className="pt-8 items-center"
                >
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
                </MotiView>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
