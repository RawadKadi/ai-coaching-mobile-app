import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Mail, ChevronLeft, ArrowRight, AlertCircle, X, Check } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GradientASCII from '@/components/GradientASCII';
import { isEmailRegistered } from '@/lib/auth-service';

export default function SignUpEmailScreen() {
  const { brand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { name: nameParam } = useLocalSearchParams<{ name?: string }>();

  const name = nameParam || '';
  const [email, setEmail] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | null>(null);
  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const emailInputRef = useRef<any>(null);
  const checkTimeoutRef = useRef<any>(null);

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const inputBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.1)';
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)';
  const brandTitle = brand?.name?.trim() || '';
  const brandInitial = (brandTitle || 'C').charAt(0).toUpperCase();

  useEffect(() => {
    // If navigated directly without a name, go to name step
    if (!name) {
      router.replace('/(auth)/signup-name');
      return;
    }
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [name]);

  // Check email existence with debounce
  const verifyEmail = useCallback(async (rawEmail: string) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailExists(false);
      setCheckingEmail(false);
      return false;
    }

    setCheckingEmail(true);
    try {
      const exists = await isEmailRegistered(cleanEmail);
      setEmailExists(exists);
      if (exists) {
        setError('');
      }
      return exists;
    } catch {
      setEmailExists(false);
      return false;
    } finally {
      setCheckingEmail(false);
    }
  }, []);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError('');
    if (emailExists) setEmailExists(false);

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    const cleanEmail = text.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(cleanEmail)) {
      checkTimeoutRef.current = setTimeout(() => {
        verifyEmail(cleanEmail);
      }, 450);
    } else {
      setCheckingEmail(false);
    }
  };

  const handleBlur = () => {
    setFocusedField(null);
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(cleanEmail) && !checkingEmail) {
      verifyEmail(cleanEmail);
    }
  };

  const handleContinue = async () => {
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

    if (emailExists) {
      return;
    }

    // Verify one more time to be 100% sure before proceeding
    setCheckingEmail(true);
    const exists = await verifyEmail(cleanEmail);
    if (exists) {
      return;
    }

    setError('');
    router.push({
      pathname: '/(auth)/signup-password',
      params: { name, email: cleanEmail },
    });
  };

  const handleGoToLogin = () => {
    router.push({
      pathname: '/(auth)/login',
      params: { email: email.trim().toLowerCase() },
    });
  };

  const isContinueDisabled = emailExists || checkingEmail || !email.trim();

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

              {/* Step-Adaptive Header Title with multi-colored text */}
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
                  WHAT'S YOUR{' '}
                  <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                    EMAIL?
                  </Text>
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2"
                >
                  Step 2 of 3 · We'll send your details here
                </Text>
              </MotiView>

              {/* Error Alert (e.g. invalid format) */}
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
                {/* 1. Email Input */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 100 } as any}
                  className="mb-3"
                >
                  <View
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1.5,
                      borderColor: emailExists
                        ? colors.error
                        : focusedField === 'email'
                        ? colors.primary
                        : inputBorder,
                      borderRadius: 28,
                    }}
                    className="px-6 py-2 flex-row items-center gap-4"
                  >
                    <Mail
                      size={20}
                      color={
                        emailExists
                          ? colors.error
                          : focusedField === 'email'
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                    <TextInput
                      ref={emailInputRef}
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Email Address"
                      placeholderTextColor={colors.textTertiary}
                      value={email}
                      onChangeText={handleEmailChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={handleBlur}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="next"
                      onSubmitEditing={handleContinue}
                      selectionColor={colors.primary}
                    />
                    {checkingEmail ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : email.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => {
                          setEmail('');
                          setEmailExists(false);
                          setError('');
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <X size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </MotiView>

                {/* Account Already Exists Warning + Clickable "Log in" link */}
                <AnimatePresence>
                  {emailExists ? (
                    <MotiView
                      from={{ opacity: 0, translateY: -8, scale: 0.98 }}
                      animate={{ opacity: 1, translateY: 0, scale: 1 }}
                      exit={{ opacity: 0, translateY: -8, scale: 0.98 }}
                      transition={{ type: 'timing', duration: 250 } as any}
                      style={{
                        backgroundColor: colors.error + '15',
                        borderColor: colors.error + '40',
                      }}
                      className="border rounded-2xl p-4 mb-4 flex-row items-start gap-3"
                    >
                      <AlertCircle size={20} color={colors.error} style={{ marginTop: 2 }} />
                      <View className="flex-1">
                        <Text
                          style={{
                            color: colors.text,
                            fontFamily: bodyFont,
                            lineHeight: 20,
                          }}
                          className="text-sm font-semibold"
                        >
                          You have already created an account with this email.{' '}
                          <Text
                            onPress={handleGoToLogin}
                            style={{
                              color: colors.primary,
                              fontFamily: headingFont,
                              textDecorationLine: 'underline',
                            }}
                            className="font-black"
                          >
                            Log in
                          </Text>
                        </Text>
                      </View>
                    </MotiView>
                  ) : null}
                </AnimatePresence>

                {/* 2. Continue Button */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 160 } as any}
                  className="mb-6 mt-2"
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: colors.primary,
                      borderBottomWidth: 4,
                      borderBottomColor: colors.primaryPressed,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: isContinueDisabled ? 0 : 0.3,
                      shadowRadius: 16,
                      elevation: isContinueDisabled ? 0 : 8,
                      borderRadius: 32,
                      opacity: isContinueDisabled ? 0.45 : 1,
                    }}
                    className="h-16 items-center justify-center flex-row gap-3"
                    onPress={handleContinue}
                    disabled={isContinueDisabled}
                  >
                    {checkingEmail ? (
                      <ActivityIndicator color={colors.textOnPrimary} />
                    ) : (
                      <>
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
                      </>
                    )}
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
