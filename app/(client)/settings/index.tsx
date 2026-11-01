import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  Activity,
  Bell,
  HelpCircle,
} from 'lucide-react-native';
import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { safeBack } from '@/lib/navigation-utils';

export default function ClientSettingsHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#0B0F19');
  const reduceMotion = useReducedMotion();

  const cardBg = isDark ? '#111827' : colors.surface;
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

  const handlePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(route as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background || '#0B0F19' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{ borderBottomColor: cardBorder, borderBottomWidth: 1 }}
          className="flex-row items-center justify-between px-6 py-4"
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              safeBack('/(client)/(tabs)/profile');
            }}
            style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={colors.text || '#FFFFFF'} />
          </TouchableOpacity>

          <View className="items-center">
            <Text
              style={{ color: colors.text || '#FFFFFF' }}
              className="font-black text-lg tracking-tight"
            >
              Settings
            </Text>
            <Text
              style={{ color: colors.textSecondary || '#94A3B8' }}
              className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
            >
              Preferences
            </Text>
          </View>

          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-4 pt-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* SECTION: ACCOUNT */}
          <Text
            style={{ color: colors.textSecondary || '#64748B' }}
            className="text-[11px] font-black uppercase tracking-[2px] px-2 mb-3"
          >
            Account
          </Text>

          {/* FIRST PRIORITY ROW: ACCOUNT & SECURITY */}
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 50 }}
            className="mb-3"
          >
            <TouchableOpacity
              onPress={() => handlePress('/(client)/settings/security')}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl flex-row items-center"
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: `${colors.primary}18`,
                  borderColor: `${colors.primary}30`,
                  borderWidth: 1,
                }}
                className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
              >
                <ShieldCheck size={22} color={colors.primary} />
              </View>

              <View className="flex-1 mr-2">
                <Text
                  style={{ color: colors.text || '#FFFFFF' }}
                  className="font-bold text-base"
                >
                  Account & Security
                </Text>
                <Text
                  style={{ color: colors.textSecondary || '#94A3B8' }}
                  className="text-xs font-medium mt-0.5"
                >
                  Email, password, connected accounts
                </Text>
              </View>

              <ChevronRight size={18} color={colors.textSecondary || '#64748B'} />
            </TouchableOpacity>
          </MotiView>

          {/* PERSONAL INFO */}
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 100 }}
            className="mb-8"
          >
            <TouchableOpacity
              onPress={() => handlePress('/(client)/personal-information')}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl flex-row items-center"
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  borderColor: 'rgba(59, 130, 246, 0.25)',
                  borderWidth: 1,
                }}
                className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
              >
                <User size={22} color="#3B82F6" />
              </View>

              <View className="flex-1 mr-2">
                <Text
                  style={{ color: colors.text || '#FFFFFF' }}
                  className="font-bold text-base"
                >
                  Personal Info
                </Text>
                <Text
                  style={{ color: colors.textSecondary || '#94A3B8' }}
                  className="text-xs font-medium mt-0.5"
                >
                  Your profile details
                </Text>
              </View>

              <ChevronRight size={18} color={colors.textSecondary || '#64748B'} />
            </TouchableOpacity>
          </MotiView>

          {/* SECTION: PREFERENCES */}
          <Text
            style={{ color: colors.textSecondary || '#64748B' }}
            className="text-[11px] font-black uppercase tracking-[2px] px-2 mb-3"
          >
            Preferences
          </Text>

          {/* HEALTH SYNC */}
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 150 }}
            className="mb-3"
          >
            <TouchableOpacity
              onPress={() => handlePress('/(client)/(tabs)/profile')}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl flex-row items-center"
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  borderColor: 'rgba(16, 185, 129, 0.25)',
                  borderWidth: 1,
                }}
                className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
              >
                <Activity size={22} color="#10B981" />
              </View>

              <View className="flex-1 mr-2">
                <Text
                  style={{ color: colors.text || '#FFFFFF' }}
                  className="font-bold text-base"
                >
                  Health Sync
                </Text>
                <Text
                  style={{ color: colors.textSecondary || '#94A3B8' }}
                  className="text-xs font-medium mt-0.5"
                >
                  Step counting and health data
                </Text>
              </View>

              <ChevronRight size={18} color={colors.textSecondary || '#64748B'} />
            </TouchableOpacity>
          </MotiView>

          {/* NOTIFICATIONS */}
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 200 }}
            className="mb-8"
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }}
              className="p-4 rounded-3xl flex-row items-center"
              activeOpacity={0.7}
            >
              <View
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                  borderWidth: 1,
                }}
                className="w-12 h-12 rounded-2xl items-center justify-center mr-3.5"
              >
                <Bell size={22} color="#F59E0B" />
              </View>

              <View className="flex-1 mr-2">
                <Text
                  style={{ color: colors.text || '#FFFFFF' }}
                  className="font-bold text-base"
                >
                  Notifications
                </Text>
                <Text
                  style={{ color: colors.textSecondary || '#94A3B8' }}
                  className="text-xs font-medium mt-0.5"
                >
                  Daily reminders and messages
                </Text>
              </View>

              <View className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 mr-2">
                <Text className="text-emerald-400 text-[10px] font-black uppercase">On</Text>
              </View>
            </TouchableOpacity>
          </MotiView>
        </ScrollView>
      </View>
    </View>
  );
}
