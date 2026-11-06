import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState } from 'react';
import { Image } from 'expo-image';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, ChevronLeft, ArrowRight, X, AlertCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView, AnimatePresence } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GoogleIcon from '@/components/GoogleIcon';
import { signInWithGoogle } from '@/lib/google-auth';
import GradientASCII from '@/components/GradientASCII';

const PENDING_INVITE_KEY = '@pending_invite_token';

export default function LoginScreen() {
  const { brand, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const inputBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.1)';
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)';
  const brandTitle = brand?.name?.trim() || '';
  const brandInitial = (brandTitle || 'C').charAt(0).toUpperCase();

  const handleContinueWithEmail = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email.');
      return;
    }

    setError('');
    router.push({
      pathname: '/(auth)/login-password',
      params: { email: cleanEmail },
    });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const res = await signInWithGoogle();
      if (res.success) {
        await refreshBrand();
        const pendingInvite = await AsyncStorage.getItem(PENDING_INVITE_KEY);
        if (pendingInvite) {
          router.replace({ pathname: '/join-team', params: { invite: pendingInvite } });
        } else {
          router.replace('/');
        }
      } else if (res.error && res.error !== 'Authentication was cancelled') {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
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
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-8 pt-6 pb-10">
              {/* Top Navigation Row */}
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

              {/* Header Title with multi-colored text (Animated) */}
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
                  LOG{' '}
                  <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                    IN
                  </Text>
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2"
                >
                  Welcome back! Enter your details
                </Text>
              </MotiView>

              {/* Error Alert */}
              <AnimatePresence>
                {error ? (
                  <MotiView
                    from={{ opacity: 0, translateY: -10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0, translateY: -10 }}
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

              {/* UPPER INTERACTIVE CONTENT (UP NOT BELOW) */}
              <View className="w-full">
                {/* 1. Google Sign In Button */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 100 } as any}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
                      borderColor: inputBorder,
                      borderWidth: 1.5,
                      borderRadius: 32,
                    }}
                    className="h-16 items-center justify-center flex-row gap-3 mb-6"
                    onPress={handleGoogleSignIn}
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
                          Continue with Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </MotiView>

                {/* 2. Divider */}
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 160 } as any}
                  className="flex-row items-center mb-6"
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: inputBorder }} />
                  <Text
                    style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                    className="px-4 text-xs font-bold uppercase tracking-wider"
                  >
                    or with email
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: inputBorder }} />
                </MotiView>

                {/* 3. Email Input */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 220 } as any}
                  className="mb-6"
                >
                  <View
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1.5,
                      borderColor: focusedField === 'email' ? colors.primary : inputBorder,
                      borderRadius: 28,
                    }}
                    className="px-6 py-2 flex-row items-center gap-4"
                  >
                    <Mail
                      size={20}
                      color={focusedField === 'email' ? colors.primary : colors.textSecondary}
                    />
                    <TextInput
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Email Address"
                      placeholderTextColor={colors.textTertiary}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (error) setError('');
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="next"
                      onSubmitEditing={handleContinueWithEmail}
                      selectionColor={colors.primary}
                    />
                    {email.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setEmail('')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <X size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </MotiView>

                {/* 4. Continue Button */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 280 } as any}
                  className="mb-8"
                >
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
                    className="h-16 items-center justify-center flex-row gap-3"
                    onPress={handleContinueWithEmail}
                  >
                    <Text
                      style={{
                        color: colors.textOnPrimary,
                        fontFamily: headingFont,
                      }}
                      className="font-black text-lg tracking-wide uppercase"
                    >
                      Continue
                    </Text>
                    <ArrowRight size={20} color={colors.textOnPrimary} />
                  </TouchableOpacity>
                </MotiView>

                {/* 5. Switch to Sign Up */}
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 340 } as any}
                  className="items-center"
                >
                  <TouchableOpacity
                    onPress={() => router.push('/(auth)/signup')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text
                      style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                      className="text-sm font-semibold tracking-wide"
                    >
                      New user?{' '}
                      <Text
                        style={{
                          color: colors.primary,
                          fontFamily: headingFont,
                        }}
                        className="font-black underline"
                      >
                        Create account
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
