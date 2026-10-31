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
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView, AnimatePresence } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';

const PENDING_INVITE_KEY = '@pending_invite_token';

export default function LoginScreen() {
  const { brand, refreshBrand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = isDarkColor(colors.background);
  const fontName = theme.typography.fontFamily || 'System';
  const headingFont = getFontFamily(fontName, '800');
  const bodyFont = getFontFamily(fontName, '500');

  const inputBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)';
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.1)';
  const brandTitle = brand?.name?.trim() || 'Welcome';
  const brandInitial = brandTitle.charAt(0).toUpperCase();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      await refreshBrand();
      const pendingInvite = await AsyncStorage.getItem(PENDING_INVITE_KEY);
      if (pendingInvite) {
        router.replace({ pathname: '/join-team', params: { invite: pendingInvite } });
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please check your details.');
      setLoading(false);
    }
  };

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
            <View className="flex-1 px-8 pt-20 pb-12">
              {/* Brand Header */}
              <MotiView
                from={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="items-center mb-14"
              >
                {brand?.logo_url ? (
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 28,
                      backgroundColor: colors.surface,
                      borderWidth: 1.5,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.25,
                      shadowRadius: 20,
                      elevation: 10,
                      overflow: 'hidden',
                      marginBottom: 24,
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
                      width: 88,
                      height: 88,
                      borderRadius: 28,
                      backgroundColor: colors.primary + '20',
                      borderWidth: 1.5,
                      borderColor: colors.primary + '40',
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.25,
                      shadowRadius: 20,
                      elevation: 10,
                      marginBottom: 24,
                    }}
                    className="items-center justify-center"
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 36,
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
                  className="text-4xl font-black text-center tracking-tight"
                >
                  {brandTitle}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: bodyFont,
                  }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2.5"
                >
                  Sign in to continue
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
                    className="border rounded-2xl p-4 mb-8 flex-row items-center gap-3"
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

              {/* Form Fields */}
              <View>
                <View className="mb-5">
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
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      selectionColor={colors.primary}
                    />
                  </View>
                </View>

                <View className="mb-8">
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
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Password"
                      placeholderTextColor={colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
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
                  className="h-20 items-center justify-center flex-row gap-3"
                  onPress={handleLogin}
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
                        className="font-black text-xl tracking-wide"
                      >
                        SIGN IN
                      </Text>
                      <LogIn size={20} color={colors.textOnPrimary} />
                    </>
                  )}
                </TouchableOpacity>

                <View className="pt-10 items-center">
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
