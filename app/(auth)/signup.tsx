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
  Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { validateInviteCode } from '@/lib/brand-service';
import { supabase } from '@/lib/supabase';
import { MotiView, AnimatePresence } from 'moti';
import {
  User,
  Mail,
  Lock,
  AlertCircle,
  ChevronLeft,
  KeyRound,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react-native';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GoogleIcon from '@/components/GoogleIcon';
import { signUpCoachWithGoogle } from '@/lib/google-auth';

export default function SignUpScreen() {
  const { brand, loadBrandById, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();
  const { invite: inviteParam } = useLocalSearchParams<{ invite?: string }>();

  const [role, setRole] = useState<'client' | 'coach'>('coach');
  const [switcherWidth, setSwitcherWidth] = useState(0);

  // Client registration state (if invited)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteParam || '');
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);

  const inviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Liquid spring slider animation
  const sliderPos = useSharedValue(0); // 0 = coach, 1 = client

  useEffect(() => {
    sliderPos.value = withSpring(role === 'coach' ? 0 : 1, {
      damping: 18,
      stiffness: 180,
      mass: 0.6,
    });
  }, [role]);

  const animatedPillStyle = useAnimatedStyle(() => {
    const pillWidth = switcherWidth > 0 ? (switcherWidth - 12) / 2 : 0;
    return {
      width: pillWidth,
      transform: [{ translateX: sliderPos.value * pillWidth }],
      opacity: switcherWidth > 0 ? 1 : 0,
    };
  });

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
    if (inviteParam) {
      if (inviteParam.length > 20) {
        setRole('coach');
        validateSubCoachInvite(inviteParam);
      } else {
        setRole('client');
        validateInvite(inviteParam);
      }
    }
  }, [inviteParam]);

  const validateSubCoachInvite = async (token: string) => {
    setValidatingInvite(true);
    try {
      const { error } = await supabase.rpc('validate_subcoach_invite', {
        p_invite_token: token,
      });
      if (error) throw error;
    } catch (err) {
      console.error('Invite validation failed:', err);
    } finally {
      setValidatingInvite(false);
    }
  };

  const validateInvite = async (code: string) => {
    if (!code) return;
    setValidatingInvite(true);
    setError('');
    try {
      const result: any = await validateInviteCode(code);
      if (result?.valid) {
        setInviteValid(true);
        const targetBrandId = result.brandId || result.brand_id || '';
        const targetCoachId = result.coachId || result.coach_id || '';
        if (targetBrandId || targetCoachId) {
          await loadBrandById(targetBrandId, targetCoachId);
        }
      } else {
        setInviteValid(false);
        setError('Invalid invite code. Please try again.');
      }
    } catch (err) {
      console.error('Invite validation failed:', err);
      setInviteValid(false);
      setError('Failed to check code.');
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleInviteChange = (text: string) => {
    setInviteCode(text);
    setInviteValid(false);
    setError('');

    if (inviteTimeoutRef.current) clearTimeout(inviteTimeoutRef.current);

    if (text.length >= 6) {
      inviteTimeoutRef.current = setTimeout(() => {
        validateInvite(text);
      }, 500);
    }
  };

  const handleClientSignUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!fullName || !cleanEmail || !password || !confirmPassword) {
      setError('Please fill in all fields.');
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
      setError(err.message || 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

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

  const canSubmitClient =
    role === 'client' && inviteValid && !loading && !validatingInvite && fullName && email && password;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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

                {/* Header Title */}
                <MotiView
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  className="mb-8"
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
                    {brandTitle ? `Join ${brandTitle}` : 'Join to get started'}
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

              {/* Bottom Interactive Area */}
              <View className="w-full">
                {/* User Type Switcher: Coach vs Client with Liquid Spring */}
                {!inviteParam && (
                  <View
                    onLayout={(e) => setSwitcherWidth(e.nativeEvent.layout.width)}
                    style={{
                      backgroundColor: surfaceBg,
                      borderColor: inputBorder,
                      borderWidth: 1,
                      position: 'relative',
                    }}
                    className="flex-row rounded-[28px] p-1.5 mb-6 overflow-hidden"
                  >
                    <Animated.View
                      style={[
                        {
                          position: 'absolute',
                          top: 6,
                          bottom: 6,
                          left: 6,
                          backgroundColor: colors.primary,
                          borderRadius: 22,
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.35,
                          shadowRadius: 8,
                          elevation: 4,
                        },
                        animatedPillStyle,
                      ]}
                    />

                    <Pressable
                      onPress={() => {
                        setRole('coach');
                        setError('');
                      }}
                      className="flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 z-10"
                    >
                      <Text
                        style={{
                          color: role === 'coach' ? colors.textOnPrimary : colors.textSecondary,
                          fontFamily: headingFont,
                        }}
                        className="font-black text-sm uppercase tracking-widest"
                      >
                        Coach
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setRole('client');
                        setInviteValid(false);
                        setInviteCode('');
                        setError('');
                      }}
                      className="flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 z-10"
                    >
                      <Text
                        style={{
                          color: role === 'client' ? colors.textOnPrimary : colors.textSecondary,
                          fontFamily: headingFont,
                        }}
                        className="font-black text-sm uppercase tracking-widest"
                      >
                        Client
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* COACH VIEW: Two clean buttons without "or" divider */}
                {role === 'coach' && (
                  <View className="gap-4">
                    {/* Sign up with Google */}
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
                            Sign up with Google
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Sign up with Email (Navigates to dedicated subpage) */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: surfaceBg,
                        borderColor: inputBorder,
                        borderWidth: 1.5,
                        borderRadius: 32,
                      }}
                      className="h-16 items-center justify-center flex-row gap-3"
                      onPress={() => router.push('/(auth)/signup-email')}
                      disabled={loading || googleLoading}
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
                  </View>
                )}

                {/* CLIENT VIEW: Invitation flow */}
                {role === 'client' && (
                  <View>
                    <View className="mb-4">
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
                    </View>

                    {/* If Invite is valid, show inputs and Create Account */}
                    {inviteValid && (
                      <MotiView
                        from={{ opacity: 0, translateY: 10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 250 } as any}
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

                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={
                            canSubmitClient
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
                          className="mt-3 h-16 items-center justify-center flex-row gap-3"
                          onPress={handleClientSignUp}
                          disabled={!canSubmitClient}
                        >
                          {loading ? (
                            <ActivityIndicator color={colors.textOnPrimary} />
                          ) : (
                            <>
                              <Text
                                style={{
                                  color: canSubmitClient
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
                                  canSubmitClient ? colors.textOnPrimary : colors.textSecondary
                                }
                              />
                            </>
                          )}
                        </TouchableOpacity>
                      </MotiView>
                    )}
                  </View>
                )}

                {/* Bottom: Log in Link */}
                <View className="pt-8 items-center">
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
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const InputField = ({
  icon,
  placeholder,
  value,
  onChange,
  secure,
  keyboardType,
  colors,
  inputBg,
  inputBorder,
  bodyFont,
}: any) => {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mb-4">
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          selectionColor={colors.primary}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
};
