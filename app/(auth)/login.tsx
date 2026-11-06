import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useRef } from 'react';
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
import { Eye, EyeOff, Mail, Lock, LogIn, ChevronLeft, ArrowRight, X, Pencil } from 'lucide-react-native';
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
  const { signIn } = useAuth();

  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordInputRef = useRef<any>(null);

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const inputBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.1)';
  const brandTitle = brand?.name?.trim() || 'Welcome';
  const brandInitial = brandTitle.charAt(0).toUpperCase();

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
    setStep('password');
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 150);
  };

  const handleLogin = async () => {
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email.trim().toLowerCase(), password);
      await refreshBrand();
      const pendingInvite = await AsyncStorage.getItem(PENDING_INVITE_KEY);
      if (pendingInvite) {
        router.replace({ pathname: '/join-team', params: { invite: pendingInvite } });
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Check your details.');
      setLoading(false);
    }
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
      <GradientASCII shape="horizon" glow={0.35} flow={0.6} speed={0.8} />
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
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  onPress={() => {
                    if (step === 'password') {
                      setError('');
                      setStep('email');
                    } else {
                      router.back();
                    }
                  }}
                  style={{
                    backgroundColor: inputBg,
                    borderColor: inputBorder,
                    borderWidth: 1,
                  }}
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ChevronLeft size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Brand Header (Centered Upper Area) */}
              <MotiView
                from={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="items-center my-auto py-8"
              >
                {brand?.logo_url ? (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 26,
                      backgroundColor: colors.surface,
                      borderWidth: 1.5,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.25,
                      shadowRadius: 20,
                      elevation: 10,
                      overflow: 'hidden',
                      marginBottom: 20,
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
                      width: 80,
                      height: 80,
                      borderRadius: 26,
                      backgroundColor: colors.primary + '20',
                      borderWidth: 1.5,
                      borderColor: colors.primary + '40',
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.25,
                      shadowRadius: 20,
                      elevation: 10,
                      marginBottom: 20,
                    }}
                    className="items-center justify-center"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 34,
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
                  className="text-3xl font-black text-center tracking-tight"
                >
                  {brandTitle}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: bodyFont,
                  }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2"
                >
                  {step === 'email' ? 'Sign in to continue' : 'Enter your password'}
                </Text>
              </MotiView>

              {/* Bottom Interactive Area */}
              <View className="w-full">
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
                      <View
                        style={{ backgroundColor: colors.error }}
                        className="w-2 h-2 rounded-full"
                      />
                      <Text
                        style={{ color: colors.error, fontFamily: bodyFont }}
                        className="text-xs font-bold flex-1"
                      >
                        {error}
                      </Text>
                    </MotiView>
                  ) : null}
                </AnimatePresence>

              {/* Option 1 Flow */}
              {step === 'email' ? (
                <MotiView
                  key="step-email"
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 250 } as any}
                >
                  {/* Google Sign In on TOP */}
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
                    disabled={loading || googleLoading}
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

                  {/* Divider */}
                  <View className="flex-row items-center mb-6">
                    <View style={{ flex: 1, height: 1, backgroundColor: inputBorder }} />
                    <Text
                      style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                      className="px-4 text-xs font-bold uppercase tracking-wider"
                    >
                      or with email
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: inputBorder }} />
                  </View>

                  {/* Email Input */}
                  <View className="mb-6">
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
                        placeholder="Email"
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
                  </View>

                  {/* Continue Button */}
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
                    disabled={loading || googleLoading}
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
              ) : (
                <MotiView
                  key="step-password"
                  from={{ opacity: 0, translateX: 16 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 250 } as any}
                >
                  {/* Selected Email Pill (Clickable to change) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setError('');
                      setStep('email');
                    }}
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
                      borderColor: inputBorder,
                      borderWidth: 1,
                      borderRadius: 20,
                    }}
                    className="p-3.5 mb-6 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3 flex-1 mr-3">
                      <Mail size={18} color={colors.primary} />
                      <Text
                        style={{ color: colors.text, fontFamily: bodyFont }}
                        className="text-sm font-semibold flex-1"
                        numberOfLines={1}
                      >
                        {email}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10">
                      <Pencil size={12} color={colors.primary} />
                      <Text
                        style={{ color: colors.primary, fontFamily: headingFont }}
                        className="text-xs font-bold"
                      >
                        Edit
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Password Input */}
                  <View className="mb-6">
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
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
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
                  </View>

                  {/* Sign In Button */}
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
                    onPress={handleLogin}
                    disabled={loading || googleLoading}
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
                          Sign In
                        </Text>
                        <LogIn size={20} color={colors.textOnPrimary} />
                      </>
                    )}
                  </TouchableOpacity>
                </MotiView>
              )}

              {/* Bottom: Create Account Option */}
              <View className="pt-8 items-center">
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(auth)/signup' })}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: bodyFont,
                    }}
                    className="font-bold text-xs uppercase tracking-widest"
                  >
                    New user?{' '}
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: headingFont,
                      }}
                    >
                      Create Account
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

