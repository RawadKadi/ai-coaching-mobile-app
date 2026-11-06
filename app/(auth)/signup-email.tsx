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
import { User, Mail, Lock, ChevronLeft, ArrowRight, AlertCircle } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';

export default function SignUpEmailScreen() {
  const { brand, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

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

  const handleSignUp = async () => {
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
      const success = await signUp(cleanEmail, password, fullName, 'coach');
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

  const canSubmit = !loading && fullName && email && password && confirmPassword;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
              {/* Top Row: Back Button + Brand Identity */}
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
                  Sign up with email
                </Text>
              </MotiView>

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

              {/* Input Form Fields */}
              <View>
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

                {/* Create Account Button (Matching Continue Button) */}
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
                  className="mt-3 h-16 items-center justify-center flex-row gap-3"
                  onPress={handleSignUp}
                  disabled={!canSubmit || loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <>
                      <Text
                        style={{
                          color: canSubmit ? colors.textOnPrimary : colors.textSecondary,
                          fontFamily: headingFont,
                        }}
                        className="font-black text-lg tracking-wide uppercase"
                      >
                        Create Account
                      </Text>
                      <ArrowRight
                        size={20}
                        color={canSubmit ? colors.textOnPrimary : colors.textSecondary}
                      />
                    </>
                  )}
                </TouchableOpacity>

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
    <View className="mb-5">
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
