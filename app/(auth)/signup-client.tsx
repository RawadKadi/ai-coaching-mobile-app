import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useEffect, useRef } from 'react';
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
import { validateInviteCode } from '@/lib/brand-service';
import { MotiView, AnimatePresence } from 'moti';
import {
  User,
  Mail,
  Lock,
  ChevronLeft,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GradientASCII from '@/components/GradientASCII';

export default function SignUpClientScreen() {
  const { brand, loadBrandById, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { invite: inviteParam } = useLocalSearchParams<{ invite?: string }>();
  const { signUp } = useAuth();

  const [inviteCode, setInviteCode] = useState(inviteParam || '');
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);
  const [targetCoachBrandId, setTargetCoachBrandId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
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

  // Validate invite code automatically when typed or provided via param
  useEffect(() => {
    if (inviteParam) {
      verifyInvite(inviteParam);
    }
  }, [inviteParam]);

  const verifyInvite = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setInviteValid(false);
      return;
    }
    setValidatingInvite(true);
    setError('');
    try {
      const res = await validateInviteCode(trimmed);
      if (res.valid) {
        setInviteValid(true);
        if (res.brandId) {
          setTargetCoachBrandId(res.brandId);
          loadBrandById(res.brandId);
        }
      } else {
        setInviteValid(false);
        setError('Invalid invite code. Ask your coach for the right code.');
      }
    } catch (err: any) {
      setInviteValid(false);
      setError(err.message || 'Error checking invite code.');
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleInviteChange = (code: string) => {
    setInviteCode(code);
    setError('');
    if (code.trim().length >= 6) {
      verifyInvite(code);
    } else {
      setInviteValid(false);
    }
  };

  const handleClientSignUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!fullName || !cleanEmail || !password || !confirmPassword) {
      setError('Please fill in all fields.');
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
      const success = await signUp(
        cleanEmail,
        password,
        fullName,
        'client',
        inviteCode || undefined
      );
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
        setError(msg || 'Sign up failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = inviteValid && !loading && !validatingInvite && fullName && email && password;

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
                  CLIENT{' '}
                  <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                    SIGN UP
                  </Text>
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2"
                >
                  {inviteValid ? 'Invite verified! Complete your details' : 'Enter your invite code to begin'}
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
                                params: { email: email.trim().toLowerCase() },
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
                {/* 1. Invite Code Input (Located UP) */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 100 } as any}
                  className="mb-5"
                >
                  <View
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1.5,
                      borderColor: inviteValid ? colors.success : inputBorder,
                      borderRadius: 28,
                    }}
                    className="px-6 py-2 flex-row items-center gap-4"
                  >
                    {inviteValid ? (
                      <CheckCircle2 size={20} color={colors.success} />
                    ) : (
                      <KeyRound size={20} color={colors.textSecondary} />
                    )}
                    <TextInput
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Enter Invite Code"
                      placeholderTextColor={colors.textTertiary}
                      value={inviteCode}
                      onChangeText={handleInviteChange}
                      autoCapitalize="characters"
                      editable={!inviteValid}
                      selectionColor={colors.primary}
                    />
                    {validatingInvite && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>
                </MotiView>

                {/* If invite is verified, show registration inputs */}
                {inviteValid && (
                  <View>
                    <MotiView
                      from={{ opacity: 0, translateY: 24 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 400, delay: 160 } as any}
                      className="mb-4"
                    >
                      <InputField
                        icon={<User size={20} color={colors.textSecondary} />}
                        placeholder="Full Name"
                        value={fullName}
                        onChange={setFullName}
                        colors={colors}
                        inputBg={inputBg}
                        inputBorder={inputBorder}
                        bodyFont={bodyFont}
                      />
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0, translateY: 24 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 400, delay: 200 } as any}
                      className="mb-4"
                    >
                      <InputField
                        icon={<Mail size={20} color={colors.textSecondary} />}
                        placeholder="Email Address"
                        value={email}
                        onChange={setEmail}
                        keyboardType="email-address"
                        colors={colors}
                        inputBg={inputBg}
                        inputBorder={inputBorder}
                        bodyFont={bodyFont}
                      />
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0, translateY: 24 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 400, delay: 240 } as any}
                      className="mb-4"
                    >
                      <InputField
                        icon={<Lock size={20} color={colors.textSecondary} />}
                        placeholder="Password"
                        value={password}
                        onChange={setPassword}
                        secure
                        colors={colors}
                        inputBg={inputBg}
                        inputBorder={inputBorder}
                        bodyFont={bodyFont}
                      />
                    </MotiView>

                    <MotiView
                      from={{ opacity: 0, translateY: 24 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 400, delay: 280 } as any}
                      className="mb-6"
                    >
                      <InputField
                        icon={<Lock size={20} color={colors.textSecondary} />}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        secure
                        colors={colors}
                        inputBg={inputBg}
                        inputBorder={inputBorder}
                        bodyFont={bodyFont}
                      />
                    </MotiView>

                    {/* Create Account Button */}
                    <MotiView
                      from={{ opacity: 0, translateY: 24 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 400, delay: 320 } as any}
                      className="mb-6"
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={
                          canSubmit
                            ? {
                                backgroundColor: colors.primary,
                                borderBottomWidth: 4,
                                borderBottomColor: colors.primaryPressed,
                                shadowColor: colors.primary,
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.3,
                                shadowRadius: 16,
                                elevation: 8,
                                borderRadius: 32,
                              }
                            : {
                                backgroundColor: surfaceBg,
                                borderWidth: 1.5,
                                borderColor: inputBorder,
                                borderRadius: 32,
                                opacity: 0.6,
                              }
                        }
                        className="h-16 items-center justify-center flex-row gap-3"
                        onPress={handleClientSignUp}
                        disabled={!canSubmit}
                      >
                        {loading ? (
                          <ActivityIndicator color={colors.textOnPrimary} />
                        ) : (
                          <>
                            <Text
                              style={{
                                color: canSubmit
                                  ? colors.textOnPrimary
                                  : colors.textSecondary,
                                fontFamily: headingFont,
                              }}
                              className="font-black text-lg tracking-wide uppercase"
                            >
                              Create Account
                            </Text>
                            <ArrowRight
                              size={20}
                              color={
                                canSubmit ? colors.textOnPrimary : colors.textSecondary
                              }
                            />
                          </>
                        )}
                      </TouchableOpacity>
                    </MotiView>
                  </View>
                )}

                {/* Log in Link */}
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 180 } as any}
                  className="pt-6 items-center"
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

function InputField({
  icon,
  placeholder,
  value,
  onChange,
  secure,
  keyboardType = 'default',
  colors,
  inputBg,
  inputBorder,
  bodyFont,
}: any) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        backgroundColor: inputBg,
        borderWidth: 1.5,
        borderColor: focused ? colors.primary : inputBorder,
        borderRadius: 28,
      }}
      className="px-6 py-2 flex-row items-center gap-4"
    >
      {icon}
      <TextInput
        style={{
          color: colors.text,
          fontFamily: bodyFont,
        }}
        className="flex-1 text-xl h-14"
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure && !show}
        keyboardType={keyboardType}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.primary}
      />
      {secure && (
        <TouchableOpacity
          onPress={() => setShow(!show)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {show ? (
            <EyeOff size={20} color={colors.textSecondary} />
          ) : (
            <Eye size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
