import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Eye, EyeOff, ChevronLeft, ArrowRight, AlertCircle } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GradientASCII from '@/components/GradientASCII';

export default function SignUpPasswordScreen() {
  const { brand, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();
  const { name: nameParam, email: emailParam } = useLocalSearchParams<{
    name?: string;
    email?: string;
  }>();

  const name = nameParam || '';
  const email = (emailParam || '').trim().toLowerCase();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'password' | 'confirm' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordInputRef = useRef<any>(null);

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
    if (!name) {
      router.replace('/(auth)/signup-name');
      return;
    }
    if (!email) {
      router.replace({ pathname: '/(auth)/signup-email', params: { name } });
      return;
    }
    const timer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [name, email]);

  const handleCreateAccount = async () => {
    if (!password) {
      setError('Please choose a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await signUp(email, password, name, 'coach');
      if (success) {
        await refreshBrand();
        router.replace('/');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists')
      ) {
        setError('already_registered');
      } else {
        setError(msg || 'Could not create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <GradientASCII shape="horizon" glow={0.5} flow={0.65} speed={1.3} inverted />
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
                  CREATE A{' '}
                  <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                    PASSWORD
                  </Text>
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2"
                >
                  Step 3 of 3 · Make it at least 6 characters
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
                    className="border rounded-2xl p-4 mb-6 flex-row items-start gap-3"
                  >
                    <AlertCircle size={18} color={colors.error} style={{ marginTop: 2 }} />
                    {error === 'already_registered' ? (
                      <View className="flex-1">
                        <Text
                          style={{ color: colors.text, fontFamily: bodyFont, lineHeight: 20 }}
                          className="text-xs font-semibold"
                        >
                          You have already created an account with this email.{' '}
                          <Text
                            onPress={() =>
                              router.push({
                                pathname: '/(auth)/login',
                                params: { email },
                              })
                            }
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
                    ) : (
                      <Text
                        style={{ color: colors.error, fontFamily: bodyFont }}
                        className="text-xs font-bold flex-1"
                      >
                        {error}
                      </Text>
                    )}
                  </MotiView>
                ) : null}
              </AnimatePresence>

              {/* UPPER INTERACTIVE CONTENT (UP NOT BELOW) */}
              <View className="w-full">
                {/* 1. Password Input */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 100 } as any}
                  className="mb-4"
                >
                  <View
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1.5,
                      borderColor: focusedField === 'password' ? colors.primary : inputBorder,
                      borderRadius: 28,
                    }}
                    className="px-6 py-2 flex-row items-center gap-4"
                  >
                    <Lock
                      size={20}
                      color={focusedField === 'password' ? colors.primary : colors.textSecondary}
                    />
                    <TextInput
                      ref={passwordInputRef}
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Password"
                      placeholderTextColor={colors.textTertiary}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (error) setError('');
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                      selectionColor={colors.primary}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color={colors.textSecondary} />
                      ) : (
                        <Eye size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </MotiView>

                {/* 2. Confirm Password Input */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 160 } as any}
                  className="mb-6"
                >
                  <View
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1.5,
                      borderColor: focusedField === 'confirm' ? colors.primary : inputBorder,
                      borderRadius: 28,
                    }}
                    className="px-6 py-2 flex-row items-center gap-4"
                  >
                    <Lock
                      size={20}
                      color={focusedField === 'confirm' ? colors.primary : colors.textSecondary}
                    />
                    <TextInput
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Confirm Password"
                      placeholderTextColor={colors.textTertiary}
                      value={confirmPassword}
                      onChangeText={(t) => {
                        setConfirmPassword(t);
                        if (error) setError('');
                      }}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showConfirmPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateAccount}
                      selectionColor={colors.primary}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} color={colors.textSecondary} />
                      ) : (
                        <Eye size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </MotiView>

                {/* 3. Create Account Button */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 220 } as any}
                  className="mb-6"
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
                    onPress={handleCreateAccount}
                    disabled={loading}
                  >
                    {loading ? (
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
                          Create Account
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
