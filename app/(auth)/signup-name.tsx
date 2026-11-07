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
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { User, ChevronLeft, ArrowRight, AlertCircle, X } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { getFontFamily } from '@/hooks/useAppFonts';
import { isDarkColor } from '@/lib/theme-utils';
import GradientASCII from '@/components/GradientASCII';

export default function SignUpNameScreen() {
  const { brand } = useBrand();
  const colors = useBrandColors();
  const theme = useTheme();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | null>(null);
  const [error, setError] = useState('');

  const nameInputRef = useRef<any>(null);

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
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError('Please enter your full name.');
      return;
    }
    setError('');
    router.push({
      pathname: '/(auth)/signup-email',
      params: { name: trimmed },
    });
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
                  LET'S START WITH{' '}
                  <Text style={{ color: colors.primary, fontFamily: headingFont }}>
                    YOUR NAME
                  </Text>
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontFamily: bodyFont }}
                  className="text-xs font-bold uppercase tracking-[4px] mt-2"
                >
                  Step 1 of 3 · What should we call you?
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
                {/* 1. Name Input */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 100 } as any}
                  className="mb-6"
                >
                  <View
                    style={{
                      backgroundColor: inputBg,
                      borderWidth: 1.5,
                      borderColor: focusedField === 'name' ? colors.primary : inputBorder,
                      borderRadius: 28,
                    }}
                    className="px-6 py-2 flex-row items-center gap-4"
                  >
                    <User
                      size={20}
                      color={focusedField === 'name' ? colors.primary : colors.textSecondary}
                    />
                    <TextInput
                      ref={nameInputRef}
                      style={{
                        color: colors.text,
                        fontFamily: bodyFont,
                      }}
                      className="flex-1 text-xl h-14"
                      placeholder="Full Name"
                      placeholderTextColor={colors.textTertiary}
                      value={fullName}
                      onChangeText={(t) => {
                        setFullName(t);
                        if (error) setError('');
                      }}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={handleContinue}
                      selectionColor={colors.primary}
                    />
                    {fullName.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setFullName('')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <X size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </MotiView>

                {/* 2. Continue Button */}
                <MotiView
                  from={{ opacity: 0, translateY: 24 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 400, delay: 160 } as any}
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
                    onPress={handleContinue}
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
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
